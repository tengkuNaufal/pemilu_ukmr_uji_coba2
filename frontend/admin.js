async function fetchResults() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const res = await fetch('/api/admin/results', {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (res.status === 403) {
        alert('Anda tidak memiliki akses ke halaman ini.');
        window.location.href = 'login.html';
        return;
    }

    if (!res.ok) throw new Error('Gagal mengambil data hasil voting');

    return res.json();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const results = await fetchResults();
  if (!results) return;

  const totalVotes = results.reduce((sum, current) => sum + parseInt(current.total_suara, 10), 0);
  document.getElementById('totalVotes').textContent = totalVotes;

  const ctx = document.getElementById('voteChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: results.map(r => r.nama),
      datasets: [{
        label: 'Persentase Suara (%)',
        data: results.map(r => r.percentage),
        backgroundColor: 'rgba(22, 163, 74, 0.5)',
        borderColor: 'rgba(22, 163, 74, 1)',
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      },
      plugins: {
        tooltip: {
            callbacks: {
                label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                        label += ': ';
                    }
                    label += parseFloat(context.raw).toFixed(2) + '%';
                    const index = context.dataIndex;
                    const totalSuara = results[index].total_suara;
                    return `${label} (${totalSuara} suara)`;
                }
            }
        }
    }
    }
  });
});
