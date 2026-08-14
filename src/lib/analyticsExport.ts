import jsPDF from 'jspdf';

export type ExportSection = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

const escapeCsv = (value: string | number) => {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCSV(filename: string, sections: ExportSection[]) {
  const lines: string[] = [];
  sections.forEach((section) => {
    lines.push(`=== ${section.title} ===`);
    lines.push(section.columns.map(escapeCsv).join(','));
    section.rows.forEach((row) => lines.push(row.map(escapeCsv).join(',')));
    lines.push('');
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

export function downloadPDF(filename: string, title: string, subtitle: string, sections: ExportSection[]) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  let y = 50;

  const newPageIfNeeded = (needed = 16) => {
    if (y + needed > pageHeight - 40) {
      doc.addPage();
      y = 50;
    }
  };

  doc.setFontSize(18);
  doc.text(title, marginX, y);
  y += 20;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(subtitle, marginX, y);
  doc.setTextColor(0);
  y += 24;

  sections.forEach((section) => {
    newPageIfNeeded(40);
    doc.setFontSize(12);
    doc.text(section.title, marginX, y);
    y += 14;
    doc.setFontSize(9);

    const colWidth = (doc.internal.pageSize.getWidth() - marginX * 2) / Math.max(section.columns.length, 1);
    doc.setTextColor(120);
    section.columns.forEach((col, i) => doc.text(String(col).slice(0, 28), marginX + i * colWidth, y));
    doc.setTextColor(0);
    y += 12;

    section.rows.slice(0, 200).forEach((row) => {
      newPageIfNeeded();
      row.forEach((cell, i) => doc.text(String(cell ?? '').slice(0, 28), marginX + i * colWidth, y));
      y += 12;
    });
    y += 16;
  });

  triggerDownload(doc.output('blob'), `${filename}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
