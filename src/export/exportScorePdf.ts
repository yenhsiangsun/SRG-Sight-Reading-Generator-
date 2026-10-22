import {jsPDF} from 'jspdf';
import type {ExerciseData} from '../music';
import {tempoMark} from '../audio/tempo';
import {drawGrandScore} from '../notation/drawGrandScore';
import {drawSingleScore} from '../notation/drawSingleScore';
import {PDF_PAGE, paginateScore, scorePixelRatio} from './pdfPagination';
import {savePdfBlob} from './savePdfBlob';
import {brand} from '../brand';
import type {Locale} from '../i18n/messages';
import {scoreTonalityLabel} from '../i18n/scoreTonality';

export interface ScorePdfOptions {exercise: ExerciseData; bpm: number; title: string; subtitle: string; studyNumber: number;locale?:Locale}

function pageHeading({exercise, bpm, title, subtitle, studyNumber,locale='zh-TW'}: ScorePdfOptions, headingFont:string,uiFont:string) {
  const canvas = document.createElement('canvas');
  canvas.width = 3000; canvas.height = 405;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.scale(3, 3);
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, 1000, 135);
  const text=(value:string,size:number,x:number,y:number,maxWidth:number,font:string,align:CanvasTextAlign='left',weight=500)=>{
    do {context.font=`${weight} ${size--}px ${font}`;}while(context.measureText(value).width>maxWidth&&size>10);
    context.textAlign=align;context.fillText(value,x,y);
  };
  // The exported sheet belongs to the same practice journal. Keep the score
  // monochrome, with a quiet brand line and one easy-to-find tempo on the right.
  context.fillStyle='#5b6655';
  text(brand.displayName,12,0,16,530,headingFont);
  text(`SIGHT READING / ${String(studyNumber).padStart(2,'0')}`,10,1000,16,400,uiFont,'right');
  context.fillStyle='#26372d';
  text(title,29,0,59,675,headingFont,'left',600);
  text(tempoMark(exercise,bpm),24,1000,59,295,uiFont,'right');
  context.fillStyle='#5b6655';
  const tonality=scoreTonalityLabel(exercise.tonality,locale);
  if(tonality){text(tonality,16,0,86,990,uiFont);text(subtitle,14,0,108,990,uiFont,'left',400);}
  else text(subtitle,14,0,91,990,uiFont,'left',400);
  context.strokeStyle='#b9c2ae';context.lineWidth=.8;
  context.beginPath();context.moveTo(0,120);context.lineTo(1000,120);context.stroke();
  return canvas;
}

/** Export the supplied snapshot, not a regenerated exercise or a screenshot of the UI. */
export async function createScorePdf(options: ScorePdfOptions): Promise<Blob> {
  const root=document.querySelector('.studio-app');
  const headingFont=(root?getComputedStyle(root).getPropertyValue('--studio-heading-font').trim():'')||'"Tonecraft Display", "Noto Serif TC", "Microsoft JhengHei", serif';
  const uiFont=(root?getComputedStyle(root).getPropertyValue('--studio-ui-font').trim():'')||'"Tonecraft Text", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
  // Canvas-only headings can need characters not yet painted in the UI.
  const tonality=scoreTonalityLabel(options.exercise.tonality,options.locale??'zh-TW');
  await Promise.all([
    document.fonts.load(`600 29px ${headingFont}`,options.title+brand.displayName),
    document.fonts.load(`500 24px ${uiFont}`,tempoMark(options.exercise,options.bpm)+(tonality??'')),
    document.fonts.load(`400 14px ${uiFont}`,options.subtitle),
  ]).catch(()=>[]);
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
  pdf.setProperties({title: options.title, subject: `Sight-reading study ${options.studyNumber}; ${tempoMark(options.exercise, options.bpm)}`, creator: brand.displayName});
  const heading = pageHeading(options,headingFont,uiFont);
  try {
    for (const [index, page] of pages.entries()) {
      if (index) pdf.addPage();
      pdf.addImage(heading, 'PNG', PDF_PAGE.margin, PDF_PAGE.margin, 180, 24.3, 'score-heading', 'FAST');
      const canvas = document.createElement('canvas');
      try {
        draw(canvas, options.exercise, requestedWidth, {...page, pixelRatio: scorePixelRatio(layout.width, page.sourceHeight)});
        pdf.addImage(canvas, 'PNG', (PDF_PAGE.width - page.width) / 2, PDF_PAGE.scoreTop, page.width, page.height, `score-page-${index}`, 'FAST');
      } finally {canvas.width = 0; canvas.height = 0;}
      pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor('#697460');
      pdf.text(brand.english,PDF_PAGE.margin,289);
      pdf.text(`${index+1} / ${pages.length}`,PDF_PAGE.width-PDF_PAGE.margin,289,{align:'right'});
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    return pdf.output('blob');
  } finally {heading.width = 0; heading.height = 0;}
}

export async function downloadScorePdf(options: ScorePdfOptions) {
  const blob = await createScorePdf(options);
  const filename=`${brand.english}-${String(options.studyNumber).padStart(2, '0')}-${options.title.replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
  return savePdfBlob(blob,filename,options.title);
}
