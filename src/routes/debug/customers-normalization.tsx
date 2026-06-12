import React, { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { normalizeCustomerRow } from "@/lib/customers/normalizeCustomer";
import { normalizeStaffProfile } from "@/lib/users/normalizeStaffProfile";

export const Route = createFileRoute("/debug/customers-normalization")({
  component: CustomersNormalizationDebug,
});

function CustomersNormalizationDebug() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<{
    rawCustomers: any[];
    normCustomers: any[];
    rawProfiles: any[];
    normProfiles: any[];
  }>({
    rawCustomers: [],
    normCustomers: [],
    rawProfiles: [],
    normProfiles: [],
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [{ data: customersData }, { data: profilesData }] = await Promise.all([
          supabase.from("customers").select("*").limit(500),
          supabase.from("profiles").select("*").limit(500),
        ]);

        const rawC = customersData || [];
        const rawP = profilesData || [];

        setData({
          rawCustomers: rawC,
          normCustomers: rawC.map((r) => {
            try { return normalizeCustomerRow(r); } catch(e) { return { _error: String(e) }; }
          }),
          rawProfiles: rawP,
          normProfiles: rawP.map((r) => {
            try { return normalizeStaffProfile(r); } catch(e) { return { _error: String(e) }; }
          }),
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (!isAdmin) {
    return <div className="p-10 text-red-500">Access Denied. Admins Only.</div>;
  }

  if (loading) {
    return <div className="p-10">Loading Debug Data...</div>;
  }

  return (
    <div className="p-8 font-mono text-sm max-w-[100vw] overflow-auto">
      <h1 className="text-2xl font-bold mb-4">Debug: Customers & Staff Normalization</h1>

      <h2 className="text-xl mt-8 mb-4">Staff / Profiles Normalization (Types)</h2>
      <table className="w-full border text-left text-xs mb-8">
        <thead>
          <tr className="bg-slate-100">
            <th className="p-2 border">ID</th>
            <th className="p-2 border">Raw display_name</th>
            <th className="p-2 border">Norm display_name</th>
            <th className="p-2 border">Raw email</th>
            <th className="p-2 border">Norm email</th>
          </tr>
        </thead>
        <tbody>
          {data.rawProfiles.map((rp, i) => {
            const np = data.normProfiles[i];
            return (
              <tr key={rp.id || i} className="border-b">
                <td className="p-2 border">{rp.id}</td>
                <td className="p-2 border">{typeof rp.display_name}</td>
                <td className="p-2 border">{typeof np?.display_name}</td>
                <td className="p-2 border">{typeof rp.email}</td>
                <td className="p-2 border">{typeof np?.email}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2 className="text-xl mt-8 mb-4">Customers Normalization (Types)</h2>
      <table className="w-full border text-left text-xs">
        <thead>
          <tr className="bg-slate-100">
            <th className="p-2 border">ID</th>
            <th className="p-2 border">owner_sale_id</th>
            <th className="p-2 border">owner_tele_id</th>
            <th className="p-2 border">Raw name</th>
            <th className="p-2 border">Norm name</th>
            <th className="p-2 border">Raw phone</th>
            <th className="p-2 border">Norm phone</th>
            <th className="p-2 border">Raw email</th>
            <th className="p-2 border">Norm email</th>
            <th className="p-2 border">Raw summary</th>
            <th className="p-2 border">Norm summary</th>
            <th className="p-2 border">Raw address</th>
            <th className="p-2 border">Norm address</th>
          </tr>
        </thead>
        <tbody>
          {data.rawCustomers.map((rc, i) => {
            const nc = data.normCustomers[i];
            return (
              <tr key={rc.id || i} className="border-b">
                <td className="p-2 border">{rc.id}</td>
                <td className="p-2 border">{rc.owner_sale_id}</td>
                <td className="p-2 border">{rc.owner_tele_id}</td>
                <td className="p-2 border">{typeof rc.name}</td>
                <td className="p-2 border">{typeof nc?.name}</td>
                <td className="p-2 border">{typeof rc.phone}</td>
                <td className="p-2 border">{typeof nc?.phone}</td>
                <td className="p-2 border">{typeof rc.email}</td>
                <td className="p-2 border">{typeof nc?.email}</td>
                <td className="p-2 border">{typeof rc.summary}</td>
                <td className="p-2 border">{typeof nc?.summary}</td>
                <td className="p-2 border">{typeof rc.address}</td>
                <td className="p-2 border">{typeof nc?.address}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
