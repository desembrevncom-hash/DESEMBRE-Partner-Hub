import { supabase } from "@/integrations/supabase/client";

export type OverrideRow = {
  no: number;
  image_url: string | null;
  link_url: string | null;
  section: string | null;
  name: string | null;
  desc: string | null;
  retail_size: string | null;
  retail_price: number | null;
  salon_size: string | null;
  salon_price: number | null;
  deleted: boolean;
  is_custom: boolean;
};

type SavePayload = {
  no?: number;
  original_no?: number;
  action?: "upsert" | "create" | "hard_delete";
  image_data_url?: string | null;
  image_url?: string | null;
  link_url?: string | null;
  section?: string | null;
  name?: string | null;
  desc?: string | null;
  retail_size?: string | null;
  retail_price?: number | null;
  salon_size?: string | null;
  salon_price?: number | null;
  deleted?: boolean;
};

export async function saveProductOverride(payload: SavePayload) {
  // Mock mode
  if (localStorage.getItem("mock_session")) {
      let overrides = JSON.parse(localStorage.getItem("mock_overrides") || "[]");
      const targetNo = payload.no!;
      const originalNo = payload.original_no ?? targetNo;
      const idx = overrides.findIndex((o: any) => o.no === originalNo);
      
      const mapped: any = { no: targetNo };
      if (payload.image_data_url !== undefined) mapped.image_url = payload.image_data_url;
      if (payload.image_url !== undefined) mapped.image_url = payload.image_url;
      if (payload.link_url !== undefined) mapped.link_url = payload.link_url;
      if (payload.section !== undefined) mapped.section = payload.section;
      if (payload.name !== undefined) mapped.name = payload.name;
      if (payload.desc !== undefined) mapped.desc = payload.desc;
      if (payload.retail_size !== undefined) mapped.retail_size = payload.retail_size;
      if (payload.retail_price !== undefined) mapped.retail_price = payload.retail_price;
      if (payload.salon_size !== undefined) mapped.salon_size = payload.salon_size;
      if (payload.salon_price !== undefined) mapped.salon_price = payload.salon_price;
      if (payload.deleted !== undefined) mapped.deleted = payload.deleted;

      let savedItem;
      if (idx >= 0) {
         if (originalNo !== targetNo) {
            overrides.splice(idx, 1);
            const fullObj = { no: targetNo, deleted: false, is_custom: payload.action === "create" || false, ...mapped };
            overrides.push(fullObj);
            savedItem = fullObj;
         } else {
            overrides[idx] = { ...overrides[idx], ...mapped };
            savedItem = overrides[idx];
         }
      } else {
         const fullObj = { no: targetNo, deleted: false, is_custom: payload.action === "create" || false, ...mapped };
         overrides.push(fullObj);
         savedItem = fullObj;
      }
      localStorage.setItem("mock_overrides", JSON.stringify(overrides));
      return { ok: true as const, row: savedItem as OverrideRow };
  }

  try {
    const { data, error } = await supabase.functions.invoke("save-product-override", {
      body: payload,
    });
    if (!error && !data?.error) {
      return { ok: true as const, row: data?.row as OverrideRow | undefined };
    }
  } catch (e) {
    // Fallback if edge function is missing or fails
  }

  // FALLBACK: Client-side logic
  let imageUrl = payload.image_url;
  
  if (payload.image_data_url) {
    try {
      const base64Data = payload.image_data_url.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      
      const fileName = `${payload.no}_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product_images')
        .upload(fileName, blob, { upsert: true });
        
      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage.from('product_images').getPublicUrl(fileName);
        imageUrl = publicUrlData.publicUrl;
      } else {
        imageUrl = payload.image_data_url; // fallback to base64
      }
    } catch(e) {
      imageUrl = payload.image_data_url;
    }
  } else if (payload.image_data_url === null) {
      imageUrl = null;
  }

  const upsertData: any = { no: payload.no };
  if (imageUrl !== undefined) upsertData.image_url = imageUrl;
  if (payload.link_url !== undefined) upsertData.link_url = payload.link_url;
  if (payload.section !== undefined) upsertData.section = payload.section;
  if (payload.name !== undefined) upsertData.name = payload.name;
  if (payload.desc !== undefined) upsertData.desc = payload.desc;
  if (payload.retail_size !== undefined) upsertData.retail_size = payload.retail_size;
  if (payload.retail_price !== undefined) upsertData.retail_price = payload.retail_price;
  if (payload.salon_size !== undefined) upsertData.salon_size = payload.salon_size;
  if (payload.salon_price !== undefined) upsertData.salon_price = payload.salon_price;
  if (payload.deleted !== undefined) upsertData.deleted = payload.deleted;

  if (payload.original_no && payload.original_no !== payload.no) {
    await supabase.from('product_overrides').delete().eq('no', payload.original_no);
  }

  const { data, error } = await supabase.from('product_overrides').upsert(upsertData).select().single();
  if (error) {
     return { ok: false as const, error: error.message };
  }
  return { ok: true as const, row: data as OverrideRow };
}
