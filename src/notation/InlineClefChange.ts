import {ClefNote,Modifier,NoteSubGroup,type BoundingBox,type StaveNote} from 'vexflow';
import type {Clef} from '../music';

/** A zero-duration clef change with real space on both sides. NoteSubGroup's
 * default alignment also subtracts right-side modifier space; that can pull
 * the glyph back onto the preceding note. Position against the actual left
 * edge of the following note/accidentals instead. */
export class InlineClefChange extends NoteSubGroup {
  private readonly clefNote:ClefNote;
  private readonly beforeGap=10;
  private readonly afterGap=12;
  private inkBounds?:BoundingBox;
  constructor(clef:Clef,annotation?:string){
    const glyph=new ClefNote(clef,'small',annotation);
    super([glyph]);this.clefNote=glyph;
  }
  preFormat(){
    if(this.preFormatted)return;
    super.preFormat();
    this.setWidth(this.getWidth()+this.beforeGap+this.afterGap);
  }
  getClefBounds(){
    const note=this.checkAttachedNote() as StaveNote,stave=note.checkStave();
    let followingLeft=note.getNoteHeadBeginX();
    for(const mark of note.getModifiers())if(mark.getCategory()==='Accidental'){
      const start=note.getModifierStartXY(Modifier.Position.LEFT,mark.checkIndex());
      followingLeft=Math.min(followingLeft,start.x+mark.getXShift()-mark.getWidth());
    }
    const glyph=this.clefNote.getClef();
    glyph.setX(followingLeft-this.afterGap-glyph.getWidth()).setY(stave.getYForLine(glyph.line));
    this.inkBounds=glyph.getBoundingBox();
    return this.inkBounds;
  }
  getBoundingBox(){return this.inkBounds??super.getBoundingBox();}
  draw(){
    const context=this.checkContext();this.getClefBounds();this.setRendered();
    context.openGroup('inline-clef-change');
    this.clefNote.getClef().renderText(context,0,0);
    context.closeGroup();
  }
}
