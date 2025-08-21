document.getElementById('adminLoginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error('Login gagal');
    const { token } = await res.json();
    localStorage.setItem('token', token);
    window.location.href = 'admin.html'; // Arahkan ke dashboard admin
  } catch(error) {
    document.getElementById('error').classList.remove('hidden');
    console.error(error);
  }
});
