// Test del parser de fecha de nacimiento usado en cumpleanos-card.tsx
// (valida que los formatos comunes del HC se interpreten correctamente)

function parseFechaNac(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || s === '-' || s === 'N/A' || s.toLowerCase() === 'null') return null;
  if (s.startsWith('Date(') || (s.includes('T') && s.includes('Z'))) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return { dia: d.getDate(), mes: d.getMonth(), anio: d.getFullYear() };
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const anio = parseInt(iso[1], 10);
    const mes = parseInt(iso[2], 10) - 1;
    const dia = parseInt(iso[3], 10);
    if (mes >= 0 && mes < 12 && dia >= 1 && dia <= 31) return { dia, mes, anio };
  }
  const latin = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (latin) {
    const dia = parseInt(latin[1], 10);
    const mes = parseInt(latin[2], 10) - 1;
    let anio = parseInt(latin[3], 10);
    if (anio < 100) anio += 1900;
    if (mes >= 0 && mes < 12 && dia >= 1 && dia <= 31) return { dia, mes, anio };
  }
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1900) return { dia: d.getDate(), mes: d.getMonth(), anio: d.getFullYear() };
  return null;
}

const casos = [
  ['1990-04-15', { dia: 15, mes: 3, anio: 1990 }],     // ISO
  ['15/04/1990', { dia: 15, mes: 3, anio: 1990 }],     // DD/MM/YYYY
  ['15-04-1990', { dia: 15, mes: 3, anio: 1990 }],     // DD-MM-YYYY
  ['15/4/90',    { dia: 15, mes: 3, anio: 1990 }],     // DD/M/YY (2 dígitos)
  ['5/12/2005',  { dia: 5,  mes: 11, anio: 2005 }],    // D/M/YYYY
  ['Mon Apr 15 1990', { dia: 15, mes: 3, anio: 1990 }], // Date.toString
  ['1990-04-15T00:00:00.000Z', { dia: 15, mes: 3, anio: 1990 }], // ISO full
  ['',           null],
  [null,         null],
  [undefined,    null],
  ['-',          null],
  ['N/A',        null],
  ['null',       null],
  ['abcdef',     null],
  ['32/13/1990', null], // inválido
];

let ok = 0, fail = 0;
for (const [input, expected] of casos) {
  const got = parseFechaNac(input);
  const gotStr = got ? JSON.stringify(got) : 'null';
  const expStr = expected ? JSON.stringify(expected) : 'null';
  if (gotStr === expStr) {
    console.log(`✅ ${JSON.stringify(input)} → ${gotStr}`);
    ok++;
  } else {
    console.log(`❌ ${JSON.stringify(input)} → ${gotStr} (esperado: ${expStr})`);
    fail++;
  }
}

console.log(`\nTotal: ${ok} OK, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
