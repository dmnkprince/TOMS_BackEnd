async function test() {
  const baseURL = 'http://localhost:5000/api/v1';

  console.log('1. Logging in as admin...');
  const loginRes = await fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@aures.gov', password: 'Password123!' }),
  });
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status, loginData.message);

  if (!loginData.data?.token) {
    console.error('Login failed:', loginData);
    return;
  }
  const token = loginData.data.token;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  console.log('\n2. Testing GET /users...');
  const usersRes = await fetch(`${baseURL}/users`, { headers });
  const usersData = await usersRes.json();
  console.log('GET /users status:', usersRes.status, 'Total users:', usersData.data?.profiles?.length ?? usersData.data?.length);

  console.log('\n3. Testing GET /profiles...');
  const profRes = await fetch(`${baseURL}/profiles`, { headers });
  const profData = await profRes.json();
  console.log('GET /profiles status:', profRes.status, 'Total profiles:', profData.data?.profiles?.length);

  console.log('\n4. Testing POST /auth/register-staff...');
  const testBadge = 'TEST-' + Math.floor(100 + Math.random() * 900);
  const testEmail = `test${Date.now()}@toms.gov`;
  const regRes = await fetch(`${baseURL}/auth/register-staff`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      full_name: 'Test Officer',
      badge_number: testBadge,
      email: testEmail,
      password: 'Password123!',
      role: 'field_agent',
      phone_number: '08012345678',
    }),
  });
  const regData = await regRes.json();
  console.log('Register status:', regRes.status, regData.message, regData.data ? `ID: ${regData.data.id}, Role: ${regData.data.role}` : regData);

  if (regData.data?.id) {
    const newUserId = regData.data.id;

    console.log('\n5. Testing PUT /users/:id to change role to supervisor...');
    const updateRes = await fetch(`${baseURL}/users/${newUserId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ role: 'supervisor' }),
    });
    const updateData = await updateRes.json();
    console.log('PUT /users/:id status:', updateRes.status, updateData.message, updateData.data?.role);

    console.log('\n6. Testing PATCH /profiles/:id/role to change role to agent...');
    const patchRes = await fetch(`${baseURL}/profiles/${newUserId}/role`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ role: 'agent' }),
    });
    const patchData = await patchRes.json();
    console.log('PATCH /profiles/:id/role status:', patchRes.status, patchData.message, patchData.data?.role);

    console.log('\n7. Testing PATCH /profiles/:id/role with role=field_agent...');
    const patchFaRes = await fetch(`${baseURL}/profiles/${newUserId}/role`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ role: 'field_agent' }),
    });
    const patchFaData = await patchFaRes.json();
    console.log('PATCH /profiles/:id/role with field_agent status:', patchFaRes.status, patchFaData);
  }
}

test();
