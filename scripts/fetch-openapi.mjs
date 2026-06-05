async function fetchSchema() {
  const url = `${process.env.SUPABASE_URL}/rest/v1/?apikey=${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  const res = await fetch(url);
  const schema = await res.json();
  
  const rpcPath = schema.paths["/rpc/match_product_chunks"];
  if (rpcPath) {
    console.log("RPC found in OpenAPI schema:");
    const params = rpcPath.post.parameters;
    console.log(JSON.stringify(params, null, 2));
  } else {
    console.log("RPC match_product_chunks NOT found in OpenAPI schema!");
  }
}
fetchSchema();
