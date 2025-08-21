export function downloadBlob(name: string, data: Blob) {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a'); 
  a.href = url; 
  a.download = name; 
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJSON(name: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(name, blob);
}

export function downloadCSV(name: string, data: Record<string, any>) {
  const headers = Object.keys(data);
  const values = Object.values(data);
  const csv = [
    headers.join(','),
    values.map(v => typeof v === 'number' ? v.toFixed(4) : String(v)).join(',')
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(name, blob);
}
