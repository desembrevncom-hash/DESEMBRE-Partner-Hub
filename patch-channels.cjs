const fs = require('fs');

let code = fs.readFileSync('src/components/customers/CustomerContactChannels.tsx', 'utf8');

// Update fetchChannels to also get social profiles and attach UID
const fetchChannelsStart = `const fetchChannels = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer_contact_channels")
        .select("*")
        .eq("customer_id", customerId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChannels(data || []);`;

const newFetchChannelsStart = `const fetchChannels = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer_contact_channels")
        .select("*")
        .eq("customer_id", customerId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch social profiles for UIDs
      const { data: profilesData } = await supabase
        .from("customer_social_profiles")
        .select("*")
        .eq("customer_id", customerId);
      
      const socialProfiles = profilesData || [];

      const channelsWithUid = data?.map(c => {
        let facebook_uid = null;
        if (c.channel_type === 'facebook') {
          if (c.social_profile_id) {
             const sp = socialProfiles.find(p => p.id === c.social_profile_id);
             if (sp) facebook_uid = sp.facebook_uid;
          } else {
             const sp = socialProfiles.find(p => p.raw_url === c.channel_value || p.normalized_url === c.normalized_value);
             if (sp) facebook_uid = sp.facebook_uid;
          }
        }
        return { ...c, facebook_uid };
      });

      setChannels(channelsWithUid || []);`;

code = code.replace(fetchChannelsStart, newFetchChannelsStart);

// Display UID in renderChannelCard
const renderCardTarget = `<div className="text-lg font-black text-slate-800 truncate" title={c.channel_value}>
                {c.normalized_value || c.channel_value}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">`;

const renderCardNew = `<div className="text-lg font-black text-slate-800 truncate" title={c.channel_value}>
                {c.normalized_value || c.channel_value}
              </div>
            </div>

            {c.channel_type === 'facebook' && c.facebook_uid && (
              <div className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 inline-block px-2 py-0.5 rounded-md mb-1 border border-indigo-100">
                UID: {c.facebook_uid}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">`;

code = code.replace(renderCardTarget, renderCardNew);

fs.writeFileSync('src/components/customers/CustomerContactChannels.tsx', code);
console.log('Patched CustomerContactChannels.tsx successfully.');
