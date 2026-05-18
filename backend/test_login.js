fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@uei.edu.ec', password: 'admin123' })
}).then(res => res.json()).then(console.log).catch(console.error);
