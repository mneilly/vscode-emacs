import * as vscode from 'vscode';

// Support for Emacs rectangles
// https://www.gnu.org/software/emacs/manual/html_node/emacs/Rectangles.html#Rectangles

/**
  * Represents a rectangle
  */
export class RectangleContent {
    
    private sel: vscode.Selection; // Selection marking the rectangle
    private text: Array<string>;   // text in rectangle
    
    constructor(sel: vscode.Selection) {
        this.sel = sel;
        this.text = [];
    }

    /**
     * Get the text array
     * @returns A copy of the text array
     */
    getContent(): Array<string>
    {
        return this.text;
    }

    /**
     * Get a rectangle from selection
     * @returns A Rectangle object containing the rectangle selection and text
     */
    static fromSelection(editor: vscode.TextEditor): RectangleContent
    {
       let sel = editor.selection;

        let top: number = sel.start.line;
        let left: number = sel.start.character;
        let bot: number = sel.end.line;
        let right: number = sel.end.character;

        // Store the selection marking the rectangle
        let rect = new RectangleContent(sel);

    	// Get relevant text span from each line and store it in the rectangle
        for (let line = top; line < (bot + 1); line++)
        {
            let pos = new vscode.Position(line, left);
            let range = new vscode.Range(pos, pos.with(line, right));
            let selectedText = editor.document.getText(range);
            rect.text.push(selectedText);
        }

        // Pad lines that are too short
        //rect.text = rect.text.map(function(e) { if (/\r|\n/.exec(e)) { return e.substring(0, e.length-1); } else { return e; }});
        let maxl = Math.max.apply(Math, rect.text.map(function (t) { return t.length }));
        let pad = Array(maxl).join(' ')
        rect.text = rect.text.map(function(e) { return (e + pad).substring(0, maxl);});

        return rect;
    }
};
