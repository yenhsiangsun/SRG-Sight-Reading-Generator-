/** Read the stable width before engraving mutates the SVG/scrollbars. Coalesce
 * resize bursts outside ResizeObserver delivery and cancel stale redraws. */
export function observeScoreWidth(container:HTMLElement,draw:(width:number)=>void){
  let previous=-1,pending:number|undefined,disposed=false;
  const render=()=>{
    pending=undefined;
    if(disposed)return;
    const width=container.clientWidth;
    if(width<=0||width===previous)return;
    previous=width;
    draw(width);
  };
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
