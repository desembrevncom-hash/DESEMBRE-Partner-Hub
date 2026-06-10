const fs = require('fs');

let code = fs.readFileSync('src/components/customers/AddCustomerDialog.tsx', 'utf8');

// 1. Imports
code = code.replace(
  'import { parseFacebookUrl, ParsedFacebookProfile } from "@/lib/customers/facebookUrlParser";',
  'import { classifyFacebookUrl, FacebookUrlClassification } from "@/lib/customers/facebookUrlClassifier";'
);

// 2. States
code = code.replace(
  'const [fbPreviewStatus, setFbPreviewStatus] = useState<"idle" | "loading" | "uid" | "username" | "invalid_fb" | "invalid">("idle");',
  'const [fbPreviewStatus, setFbPreviewStatus] = useState<"idle" | "loading" | "uid" | "username" | "invalid_type" | "invalid_fb" | "invalid">("idle");'
);
code = code.replace(
  'const [fbParsedData, setFbParsedData] = useState<ParsedFacebookProfile | null>(null);',
  'const [fbParsedData, setFbParsedData] = useState<FacebookUrlClassification | null>(null);'
);

// 3. useEffect logic
const oldUseEffectLogic = `      const parsed = parseFacebookUrl(val);
      setFbParsedData(parsed);

      if (parsed.facebookUid) {
        setFbPreviewStatus("uid");
      } else if (parsed.facebookUsername) {
        setFbPreviewStatus("username");
      } else if (val.toLowerCase().includes("facebook.com") || val.toLowerCase().includes("fb.com")) {
        setFbPreviewStatus("invalid_fb");
      } else {
        setFbPreviewStatus("invalid");
      }

      // Check duplicate
      const dupRes = await checkCustomerDuplicate({
        phone: form.phone,
        facebookUid: parsed.facebookUid || undefined,
        facebookUsername: parsed.facebookUsername || undefined,
        normalizedUrl: parsed.normalizedUrl || undefined,
      });`;

const newUseEffectLogic = `      const parsed = classifyFacebookUrl(val);
      setFbParsedData(parsed);

      if (parsed.type === 'INVALID') {
         setFbPreviewStatus("invalid");
      } else if (['GROUP', 'POST', 'REEL', 'STORY', 'MESSENGER'].includes(parsed.type)) {
         setFbPreviewStatus("invalid_type");
      } else if (parsed.uid) {
        setFbPreviewStatus("uid");
      } else if (parsed.username) {
        setFbPreviewStatus("username");
      } else if (val.toLowerCase().includes("facebook.com") || val.toLowerCase().includes("fb.com")) {
        setFbPreviewStatus("invalid_fb");
      } else {
        setFbPreviewStatus("invalid");
      }

      // Check duplicate
      const dupRes = await checkCustomerDuplicate({
        phone: form.phone,
        facebookUid: parsed.uid || undefined,
        facebookUsername: parsed.username || undefined,
        normalizedUrl: parsed.normalizedUrl || undefined,
      });`;

code = code.replace(oldUseEffectLogic, newUseEffectLogic);

// 4. Save logic - we need to move the Facebook profile creation BEFORE contact channel
const handleSaveStart = `      // 4. Handle Primary Channel
      const scope = isAdmin || isSubAdmin ? "official" : "private";`;

const oldSaveEnd = `      // --- End Facebook Identity Save ---

      onOpenChange(false);`;

const targetBlockToReplace = code.substring(code.indexOf(handleSaveStart), code.indexOf(oldSaveEnd) + oldSaveEnd.length);

const newBlock = `      // 4. Handle Facebook Profile First (so we can get social_profile_id)
      let currentSocialProfileId: string | null = null;
      if (form.primary_channel_type === "facebook" && form.primary_channel_value.trim()) {
        const rawUrl = form.primary_channel_value.trim();
        const uid = fbParsedData?.uid;
        const username = fbParsedData?.username;
        const normalized = fbParsedData?.normalizedUrl;
        const fbType = fbParsedData?.type || 'UNKNOWN';
        
        const isUnsupported = ['GROUP', 'POST', 'REEL', 'STORY', 'MESSENGER', 'INVALID'].includes(fbType);
        
        let resolver_status = "unresolved";
        let confidence_score = null;
        if (uid) {
          resolver_status = "resolved";
          confidence_score = 100;
        } else if (username) {
          resolver_status = "parsed_only";
          confidence_score = 40;
        }

        // Insert social profile if we parsed something or if it's a valid link
        if (fbType !== 'INVALID') {
          const { data: spData, error: spErr } = await supabase.from("customer_social_profiles").insert({
            customer_id: newCustomer.id,
            platform: "facebook",
            raw_url: rawUrl,
            normalized_url: normalized,
            facebook_uid: uid,
            facebook_username: username,
            resolver_status,
            resolver_method: "local_parser",
            confidence_score
          }).select('id').single();
          
          if (spErr) {
            console.warn("Failed to insert customer_social_profiles:", spErr);
            toast.warning("Lỗi lưu hồ sơ Facebook: " + spErr.message);
          } else if (spData) {
            currentSocialProfileId = spData.id;
          }
        }

        // Determine if we need a job and what status it should have
        if (fbType !== 'INVALID' && !uid) {
          let auto_resolve_status = 'not_attempted';
          let jobStatus = 'manual_review_required';
          let errorLog = null;
          
          if (isUnsupported) {
            auto_resolve_status = 'skipped_invalid_type';
            errorLog = \`Unsupported Facebook URL type: \${fbType}\`;
          }
          
          const { data: jobData, error: jobErr } = await supabase.from("facebook_identity_resolution_jobs").insert({
            customer_id: newCustomer.id,
            raw_url: rawUrl,
            status: jobStatus,
            resolver_method: "local_parser",
            confidence_score: confidence_score || 0,
            created_by: user?.id,
            auto_resolve_status: auto_resolve_status,
            last_auto_resolve_error: errorLog
          }).select('id').single();
          
          if (jobErr) {
            console.warn("Failed to insert facebook_identity_resolution_jobs:", jobErr);
          } else if (jobData) {
            if (isUnsupported) {
               // Log audit skipped
               await supabase.from("facebook_identity_resolution_audit").insert({
                  job_id: jobData.id,
                  provider_status: 'skipped_invalid_type',
                  raw_response: { error: errorLog },
                  processed_at: new Date().toISOString()
               }).catch(e => console.warn(e));
               toast.info("Link Facebook thuộc loại nhóm/bài viết, sẽ bỏ qua phân giải tự động.");
            } else {
               // Trigger background auto-resolver silently
               supabase.functions.invoke("resolve-facebook-uid", {
                 body: { job_id: jobData.id }
               }).catch(e => console.warn("Auto-resolver invoke failed:", e));
               toast.info("Hệ thống đang thử tìm UID tự động trong nền...");
            }
          }
        }
      }

      // 5. Handle Primary Channel
      const scope = isAdmin || isSubAdmin ? "official" : "private";

      // Create Phone Channel (always created)
      try {
        await createContactChannel({
          customerId: newCustomer.id,
          channelType: "phone",
          value: form.phone.trim(),
          scope,
          is_primary: form.primary_channel_type === "phone",
          channel_purpose: "sales",
          user,
        });
      } catch (phoneErr: any) {
        toast.warning("Khách đã tạo, nhưng không lưu được kênh SĐT: " + phoneErr.message);
      }

      if (form.primary_channel_type !== "phone" && form.primary_channel_value.trim()) {
        // Create selected primary channel
        try {
          const { error: resErr } = await createContactChannel({
            customerId: newCustomer.id,
            channelType: form.primary_channel_type,
            value: form.primary_channel_value.trim(),
            scope,
            is_primary: true,
            channel_purpose: "sales",
            user,
            social_profile_id: currentSocialProfileId
          });
          if (resErr) throw resErr;
          toast.success("Đã tạo khách hàng mới.");
        } catch (err: any) {
          toast.warning("Khách đã tạo, nhưng kênh liên hệ chính chưa lưu được: " + err.message);
        }
      } else {
        toast.success("Đã tạo khách hàng mới.");
      }

      onOpenChange(false);`;

code = code.replace(targetBlockToReplace, newBlock);

// 5. Add invalid_type to UI
const uiInvalidFb = `{fbPreviewStatus === "invalid_fb" && (`;
const uiInvalidType = `{fbPreviewStatus === "invalid_type" && (
                      <div className="text-xs text-amber-700 bg-amber-50/80 px-3 py-2.5 rounded-xl flex items-start gap-2 border border-amber-100">
                        <AlertCircle className="w-4 h-4 text-amber-500 mt-px shrink-0" />
                        <div>
                          <span className="font-bold">Hệ thống không tự động phân giải loại link này (Group, Bài viết, Reel...).</span>
                          <div className="opacity-80 text-[10px] mt-0.5">Sẽ đưa vào hàng đợi kiểm tra thủ công.</div>
                        </div>
                      </div>
                    )}
                    {fbPreviewStatus === "invalid_fb" && (`

code = code.replace(uiInvalidFb, uiInvalidType);

// Fix uid references in preview UI
code = code.replace(/fbParsedData\?\.facebookUid/g, "fbParsedData?.uid");
code = code.replace(/fbParsedData\?\.facebookUsername/g, "fbParsedData?.username");

fs.writeFileSync('src/components/customers/AddCustomerDialog.tsx', code);
console.log('Patched AddCustomerDialog.tsx successfully.');
