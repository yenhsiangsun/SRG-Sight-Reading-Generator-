/** Read the stable width before engraving mutates the SVG/scrollbars. Coalesce
 * resize bursts outside ResizeObserver delivery and cancel stale redraws. */
export function observeScoreWidth(container:HTMLElement,draw:(width:number)=>void){
  let previous=-1,pending:number|undefined,disposed=false;
  const fonts=container.ownerDocument?.fonts;
  let fontsReady=!fonts || fonts.check('40px Bravura')&&fonts.check('16px Academico');
  const render=()=>{
    pending=undefined;
    if(disposed||!fontsReady)return;
    const width=container.clientWidth;
    if(width<=0||width===previous)return;
    previous=width;
    draw(width);
  };
  if(!fontsReady){
    const finish=()=>{fontsReady=true;render();};
    // VexFlow embeds these fonts, but their first FontFace load is asynchronous.
    // Never measure clefs/accidentals with fallback glyph widths. On a font
    // failure retain the existing fallback rather than hiding the score.
    void Promise.all([fonts!.load('40px Bravura'),fonts!.load('16px Academico')]).then(finish,finish);
  }
  render();
  const observer=new ResizeObserver(()=>{
    const width=container.clientWidth;
    if(!disposed&&pending===undefined&&width>0&&width!==previous)
      pending=requestAnimationFrame(render);
  });
  observer.observe(container);
  return()=>{
    disposed=true;observer.disconnect();
    if(pending!==undefined)cancelAnimationFrame(pending);
  };
}
