-- Phase 4D: Fix Audit Log for Safe Batch Import Confirmation
-- ID: 20260729000004_fix_confirm_import_audit_log.sql

-- Drop existing function if any
DROP FUNCTION IF EXISTS public.confirm_customer_import_batch(uuid);

-- Create RPC
CREATE OR REPLACE FUNCTION public.confirm_customer_import_batch(p_batch_id uuid)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id uuid;
    v_batch record;
    v_row record;
    v_inserted_rows integer := 0;
    v_skipped_rows integer := 0;
    v_failed_rows integer := 0;
    v_duplicate_rows integer := 0;
    v_new_customer_id uuid;
    v_existing_customer_id uuid;
    v_has_admin_role boolean;
    v_has_sub_admin_role boolean;
BEGIN
    -- 1. Get current user
    v_user_id := auth.uid();
    
    -- 2. Role Check
    -- Check if user is admin or sub_admin
    v_has_admin_role := public.has_role(v_user_id, 'admin');
    v_has_sub_admin_role := public.has_role(v_user_id, 'sub_admin');
    
    IF NOT (v_has_admin_role OR v_has_sub_admin_role) THEN
        RAISE EXCEPTION 'Access denied. Only admin or sub_admin can confirm batch imports.';
    END IF;

    -- 3. Lock Batch
    SELECT * INTO v_batch 
    FROM public.customer_import_batches 
    WHERE id = p_batch_id 
    FOR UPDATE;

    IF v_batch IS NULL THEN
        RAISE EXCEPTION 'Batch not found (ID: %)', p_batch_id;
    END IF;

    IF v_batch.status = 'completed' THEN
        RETURN jsonb_build_object(
            'batch_id', p_batch_id,
            'status', 'completed',
            'message', 'Batch is already completed',
            'inserted_rows', COALESCE(v_batch.inserted_rows, 0),
            'skipped_rows', COALESCE(v_batch.skipped_rows, 0),
            'failed_rows', COALESCE(v_batch.failed_rows, 0),
            'duplicate_rows', COALESCE(v_batch.duplicate_rows, 0)
        );
    END IF;

    IF v_batch.status = 'processing' THEN
        RAISE EXCEPTION 'Batch is already processing by another process.';
    END IF;

    -- Update batch to processing
    UPDATE public.customer_import_batches 
    SET status = 'processing' 
    WHERE id = p_batch_id;

    -- 4. Loop through valid rows
    FOR v_row IN 
        SELECT * FROM public.customer_import_rows 
        WHERE batch_id = p_batch_id 
          AND import_action = 'create_new' 
          AND imported_customer_id IS NULL 
          AND (is_valid = true OR validation_status IN ('valid', 'warning'))
    LOOP
        BEGIN
            -- Real-time duplicate check
            v_existing_customer_id := NULL;
            
            IF v_row.normalized_phone IS NOT NULL THEN
                SELECT id INTO v_existing_customer_id 
                FROM public.customers 
                WHERE normalized_phone = v_row.normalized_phone 
                LIMIT 1;
            END IF;
            
            IF v_existing_customer_id IS NULL AND v_row.normalized_email IS NOT NULL THEN
                SELECT id INTO v_existing_customer_id 
                FROM public.customers 
                WHERE normalized_email = v_row.normalized_email 
                LIMIT 1;
            END IF;

            IF v_existing_customer_id IS NOT NULL THEN
                -- Mark as duplicate
                UPDATE public.customer_import_rows
                SET validation_status = 'duplicate',
                    import_action = 'skip',
                    duplicate_reason = 'Trùng dữ liệu lúc confirm',
                    matched_customer_id = v_existing_customer_id
                WHERE id = v_row.id;
                
                v_skipped_rows := v_skipped_rows + 1;
                v_duplicate_rows := v_duplicate_rows + 1;
                CONTINUE; -- Skip to next row
            END IF;

            -- 5. Insert Customer
            -- name fallback: name || contact_name || business_name || facility_name
            INSERT INTO public.customers (
                name,
                contact_name,
                business_name,
                facility_name,
                phone,
                normalized_phone,
                email,
                normalized_email,
                address,
                city,
                source,
                customer_channel,
                status,
                lifecycle_stage,
                note,
                owner_sale_id,
                owner_tele_id,
                created_by
            ) VALUES (
                COALESCE(v_row.name, v_row.contact_name, v_row.business_name, v_row.facility_name, 'Unknown'),
                v_row.contact_name,
                v_row.business_name,
                v_row.facility_name,
                v_row.phone,
                v_row.normalized_phone,
                v_row.email,
                v_row.normalized_email,
                v_row.address,
                v_row.city,
                v_row.source,
                COALESCE(v_row.customer_channel, 'direct_sales'),
                'new', -- default status
                'new_lead', -- default lifecycle_stage
                v_row.note,
                v_row.owner_sale_id,
                v_row.owner_tele_id,
                COALESCE(v_user_id, v_batch.created_by)
            ) RETURNING id INTO v_new_customer_id;

            -- 6. Insert Audit Activity
            -- FIXED FOR PHASE 4D: use 'note' instead of 'system', and drop 'metadata' column which doesn't exist
            BEGIN
                INSERT INTO public.customer_activities (
                    customer_id,
                    activity_type,
                    title,
                    content,
                    created_by
                ) VALUES (
                    v_new_customer_id,
                    'note',
                    'Imported từ Excel/CSV',
                    'Customer created by import batch ' || p_batch_id,
                    v_user_id
                );
            EXCEPTION WHEN OTHERS THEN
                -- Ignore activity insertion error to ensure customer import succeeds
                RAISE WARNING 'Failed to insert customer_activities for customer_id: %', v_new_customer_id;
            END;

            -- 7. Update Import Row
            UPDATE public.customer_import_rows
            SET imported_customer_id = v_new_customer_id,
                import_action = 'imported'
            WHERE id = v_row.id;

            v_inserted_rows := v_inserted_rows + 1;

        EXCEPTION WHEN OTHERS THEN
            -- Record failure for this specific row without aborting the batch
            UPDATE public.customer_import_rows
            SET validation_status = 'error',
                error_message = SQLERRM
            WHERE id = v_row.id;
            
            v_failed_rows := v_failed_rows + 1;
        END;
    END LOOP;

    -- 8. Finalize Batch
    UPDATE public.customer_import_batches 
    SET status = 'completed',
        inserted_rows = COALESCE(inserted_rows, 0) + v_inserted_rows,
        skipped_rows = COALESCE(skipped_rows, 0) + v_skipped_rows,
        failed_rows = COALESCE(failed_rows, 0) + v_failed_rows,
        duplicate_rows = COALESCE(duplicate_rows, 0) + v_duplicate_rows,
        completed_at = now()
    WHERE id = p_batch_id;

    RETURN jsonb_build_object(
        'batch_id', p_batch_id,
        'status', 'completed',
        'message', 'Batch imported successfully',
        'inserted_rows', v_inserted_rows,
        'skipped_rows', v_skipped_rows,
        'failed_rows', v_failed_rows,
        'duplicate_rows', v_duplicate_rows
    );

EXCEPTION WHEN OTHERS THEN
    -- If batch lock was acquired, mark as failed
    UPDATE public.customer_import_batches
    SET status = 'failed',
        error_message = SQLERRM
    WHERE id = p_batch_id;
    
    RETURN jsonb_build_object(
        'batch_id', p_batch_id,
        'status', 'failed',
        'message', SQLERRM,
        'inserted_rows', v_inserted_rows,
        'skipped_rows', v_skipped_rows,
        'failed_rows', v_failed_rows,
        'duplicate_rows', v_duplicate_rows
    );
END;
$$;

-- Revoke execute from public to enforce security
REVOKE EXECUTE ON FUNCTION public.confirm_customer_import_batch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_customer_import_batch(uuid) TO authenticated;
