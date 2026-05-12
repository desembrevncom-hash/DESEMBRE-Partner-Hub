import { supabase } from "@/integrations/supabase/client";
import { saveDbProduct, deleteDbProduct } from "@/lib/catalogDb";

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

  // Mirror CRUD operation directly into the core DB catalog tables as requested
  if (payload.no) {
    const variantsArr = [];
    if (payload.retail_price !== undefined && payload.retail_price !== null) {
      variantsArr.push({
        id: `${payload.no}-retail`,
        type: "retail" as const,
        size: payload.retail_size || "150ml",
        price: payload.retail_price,
      });
    }
    if (payload.salon_price !== undefined && payload.salon_price !== null) {
      variantsArr.push({
        id: `${payload.no}-salon`,
        type: "salon" as const,
        size: payload.salon_size || "1000ml",
        price: payload.salon_price,
      });
    }

    saveDbProduct({
      id: payload.no,
      name: payload.name || undefined,
      description: payload.desc || undefined,
      categoryId: payload.section || undefined,
      imageUrl: imageUrl || undefined,
      linkUrl: payload.link_url || undefined,
      isCustom: payload.action === "create" || false,
      isDeleted: payload.deleted || false,
      variants: variantsArr.length > 0 ? variantsArr : undefined,
    }).catch(err => console.warn("Direct core DB save sync failed", err));
  }

  return { ok: true as const, row: data as OverrideRow };
}
