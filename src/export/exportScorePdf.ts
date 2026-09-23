import {jsPDF} from 'jspdf';
import type {ExerciseData} from '../music';
import {tempoMark} from '../audio/tempo';
import {drawGrandScore} from '../notation/drawGrandScore';
import {drawSingleScore} from '../notation/drawSingleScore';
import {PDF_PAGE, paginateScore, scorePixelRatio} from './pdfPagination';

export interface ScorePdfOptions {exercise: ExerciseData; bpm: number; title: string; subtitle: string; studyNumber: number}

function pageHeading({exercise, bpm, title, subtitle, studyNumber}: ScorePdfOptions) {
  const canvas = document.createElement('canvas');
  canvas.width = 3000; canvas.height = 405;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.scale(3, 3);
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, 1000, 135);
  context.fillStyle = '#4b5563';
  context.font = '12px Arial, sans-serif';
  context.fillText(`SIGHT READING / ${String(studyNumber).padStart(2, '0')}`, 0, 15);
  const text = (value: string, size: number, y: number, weight = 'normal') => {
    do {context.font = `${weight} ${size--}px Arial, "Microsoft JhengHei", sans-serif`;} while (context.measureText(value).width > 990 && size > 10);
    context.fillText(value, 0, y);
  };
  context.fillStyle = '#111827';
  text(title, 27, 49, 'bold');
  text(tempoMark(exercise, bpm), 25, 84, 'bold');
  context.fillStyle = '#4b5563'; text(subtitle, 15, 112);
  context.strokeStyle = '#d1d5db'; context.lineWidth = 1;
  context.beginPath(); context.moveTo(0, 130); context.lineTo(1000, 130); context.stroke();
  return canvas;
}

/** Export the supplied snapshot, not a regenerated exercise or a screenshot of the UI. */
export async function createScorePdf(options: ScorePdfOptions): Promise<Blob> {
  await document.fonts.ready;
  const draw = options.exercise.lowerMeasures ? drawGrandScore : drawSingleScore;
  const scratch = document.createElement('div');
  let requestedWidth = 1000;
  let layout = draw(scratch, options.exercise, requestedWidth);
  // Avoid scaling dense pairs to unreadable sizes on paper. Use a complete bar per row.
  if (layout.width > 1150) {
    requestedWidth = 700; scratch.replaceChildren();
    layout = draw(scratch, options.exercise, requestedWidth);
  }
  scratch.replaceChildren();
  const pages = paginateScore(layout);
  const pdf = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true});
  pdf.setProperties({title: options.title, subject: `Sight-reading study ${options.studyNumber}; ${tempoMark(options.exercise, options.bpm)}`, creator: 'Sight Reading'});
  const heading = pageHeading(options);
  try {
    for (const [index, page] of pages.entries()) {
      if (index) pdf.addPage();
      pdf.addImage(heading, 'PNG', PDF_PAGE.margin, PDF_PAGE.margin, 180, 24.3, 'score-heading', 'FAST');
      const canvas = document.createElement('canvas');
      try {
        draw(canvas, options.exercise, requestedWidth, {...page, pixelRatio: scorePixelRatio(layout.width, page.sourceHeight)});
        pdf.addImage(canvas, 'PNG', (PDF_PAGE.width - page.width) / 2, PDF_PAGE.scoreTop, page.width, page.height, `score-page-${index}`, 'FAST');
      } finally {canvas.width = 0; canvas.height = 0;}
      pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor('#64748b');
      pdf.text(`${index + 1} / ${pages.length}`, PDF_PAGE.width / 2, 289, {align: 'center'});
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    return pdf.output('blob');
  } finally {heading.width = 0; heading.height = 0;}
}

export async function downloadScorePdf(options: ScorePdfOptions) {
  const blob = await createScorePdf(options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Sight-Reading-${String(options.studyNumber).padStart(2, '0')}-${options.title.replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
  document.body.append(link); link.click(); link.remove();
  // Give Safari time to finish opening/saving the generated document.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
