// Original code base is from hiro-sun version of the extension:
// https://marketplace.visualstudio.com/items?itemName=hiro-sun.vscode-emacs

import * as vscode from 'vscode';
import { RegisterContent, RegisterKind } from './registers';
import { RectangleContent } from './rectangles';

/** vscode keybindinds are limited to sequences of two (with modifider keys).
 * To support longer keybinding sequences, onType() is used below and
 * keypresses are used to set the current state of the binding.
 */

/** The valid keybinding states */
enum KeybindProgressMode
{
    None,   // No current keybind is currently in progress
    RMode,  // Rectangle and/or Register keybinding  [started by 'C-x+r'] is currently in progress
    RModeR, // 'Save Rectangle in register' keybinding [started by 'C-x+r+r'] is currently in progress
    RModeS, // 'Save Region in register' keybinding [started by 'C-x+r+s'] is currently in progress
    RModeI, // 'Insert Register content into buffer' keybinding [started by 'C-x+r+i'] is currently in progress
    RModeP, // 'Save Position in register' keybinding [started by 'C-x+r+<spc>'] is currently in progress
    RModeJ, // 'Set Position from register' keybinding [started by 'C-x+r+j'] is currently in progress
    AMode,  // 
    AModeI,  // 
    MacroRecordingMode  // (FUTURE, TBD) Emacs macro recording [started by 'Ctrl-x+('] is currently in progress
};

// The current recentering position (when C-l is invoked multiple times in a row)
enum RecenterPosition
{
    Middle,
    Top,
    Bottom
};

export class Editor
{
    // The current keybinding state
    private keybindProgressMode: KeybindProgressMode;

    // Recentering
    private centerState: RecenterPosition;

    // Regsiters
    private registersStorage: { [key: string]: RegisterContent; };

    // Rectangles
    private lastRectString: string;

    // Kill
    private killRing: string;
    private killRect: RectangleContent; // the last killed rectangle
    private isKillRepeated: boolean;

    // Abbrev mode
    abbrevMode : boolean;
    private abbrevs = {};

    // Mode indicator
    private modes: string[];

    // Emacs command arguments via C-u
    private universalArg: string;

    // Constructor/initialization
    constructor()
    {
        this.keybindProgressMode = KeybindProgressMode.None;

        this.centerState = RecenterPosition.Middle;

        this.lastRectString = '';

        this.killRing = '';
        this.isKillRepeated = false;

        this.registersStorage = {};

        this.abbrevMode = false;

        this.modes = [];

        vscode.window.onDidChangeTextEditorSelection(() =>
        {
            this.isKillRepeated = false;
        });
    }

    /**
     * Set status message for 1 second
     * @param text The message to be displayed on the status bar
     * @returns    Returns a disposable to be used to dispose of the message
     */
    setStatusBarMessage(text: string): vscode.Disposable
    {
        return vscode.window.setStatusBarMessage(text, 1000);
    }

    /**
     * Set status message until changed explicitly.
     * @param text The message to be displayed on the status bar
     * @returns    Returns a disposable to be used to dispose of the message
     */
    setStatusBarPermanentMessage(text: string): vscode.Disposable
    {
        return vscode.window.setStatusBarMessage(text);
    }

    /**
     * Get current selection as a range
     */
    getSelectionRange(): vscode.Range
    {
        let selection = vscode.window.activeTextEditor.selection,
            start = selection.start,
            end = selection.end;

        return (start.character !== end.character || start.line !== end.line) ? new vscode.Range(start, end) : null;
    }

    /**
     * Get current selection
     */
    getSelection(): vscode.Selection
    {
        return vscode.window.activeTextEditor.selection;
    }

    /**
     * Set the current selection based on the given start and end positions
     * @param start Start of selection
     * @param end End of selection
     */
    setSelection(start: vscode.Position, end: vscode.Position): void
    {
        let editor = vscode.window.activeTextEditor;

        editor.selection = new vscode.Selection(start, end);
    }

    /** 
     * Behave like Emacs kill command by saving killed lines to the king ring
    */
    kill(): void
    {
        let saveIsKillRepeated = this.isKillRepeated,
            promises = [
                vscode.commands.executeCommand("emacs.exitMarkMode"),
                vscode.commands.executeCommand("cursorEndSelect")
            ];

        Promise.all(promises).then(() =>
        {
            let selection = this.getSelection(),
                range = new vscode.Range(selection.start, selection.end);

            this.setSelection(range.start, range.start);
            this.isKillRepeated = saveIsKillRepeated;
            if (range.isEmpty)
            {
                this.killEndOfLine(saveIsKillRepeated, range);
            } else
            {
                this.killText(range);
            }
        });
    }

    /**
     * If region is empty at the end of the line then kill the newline. If the
     * region is empty at the end of the buffer report end of buffer.
     * @param saveIsKillRepeated True for consecutive kills
     * @param range The range indicating the region to be killed
     */
    private killEndOfLine(saveIsKillRepeated: boolean, range: vscode.Range): void
    {
        let doc = vscode.window.activeTextEditor.document,
            eof = doc.lineAt(doc.lineCount - 1).range.end;

        if (doc.lineCount && !range.end.isEqual(eof) &&
            doc.lineAt(range.start.line).rangeIncludingLineBreak)
        {
            this.isKillRepeated ? this.killRing += '\n' : this.killRing = '\n';
            saveIsKillRepeated = true;
        } else
        {
            this.setStatusBarMessage("End of buffer");
        }
        vscode.commands.executeCommand("deleteRight").then(() =>
        {
            this.isKillRepeated = saveIsKillRepeated;
        });
    }

    /**
     * Kill the indicated region.
     * @param range The range containing the text to be killed
     */
    private killText(range: vscode.Range): void
    {
        let text = vscode.window.activeTextEditor.document.getText(range),
            promises = [
                Editor.delete(range),
                vscode.commands.executeCommand("emacs.exitMarkMode")
            ];

        this.isKillRepeated ? this.killRing += text : this.killRing = text;
        Promise.all(promises).then(() =>
        {
            this.isKillRepeated = true;
        });
    }

    /**
     * 
     * @param range 
     */
    copy(range: vscode.Range = null): boolean
    {
        this.killRing = '';
        if (range === null)
        {
            range = this.getSelectionRange();
            if (range === null)
            {
                vscode.commands.executeCommand("emacs.exitMarkMode");
                return false;
            }
        }
        this.killRing = vscode.window.activeTextEditor.document.getText(range);
        vscode.commands.executeCommand("emacs.exitMarkMode");
        return this.killRing !== undefined;
    }

    /**
     * 
     */
    cut(): boolean
    {
        let range: vscode.Range = this.getSelectionRange();

        if (!this.copy(range))
        {
            return false;
        }
        Editor.delete(range);
        return true;
    }

    /**
     * 
     */
    yank(): boolean
    {
        if (this.killRing.length === 0)
        {
            return false;
        }
        vscode.window.activeTextEditor.edit(editBuilder =>
        {
            editBuilder.insert(this.getSelection().active, this.killRing);
        });
        this.isKillRepeated = false;
        return true;
    }

    /**
     * 
     */
    undo(): void
    {
        vscode.commands.executeCommand("undo");
    }

    /**
     * 
     * @param range 
     */
    private getFirstBlankLine(range: vscode.Range): vscode.Range
    {
        let doc = vscode.window.activeTextEditor.document;

        if (range.start.line === 0)
        {
            return range;
        }
        range = doc.lineAt(range.start.line - 1).range;
        while (range.start.line > 0 && range.isEmpty)
        {
            range = doc.lineAt(range.start.line - 1).range;
        }
        if (range.isEmpty)
        {
            return range;
        } else
        {
            return doc.lineAt(range.start.line + 1).range;
        }
    }

    /**
     * 
     */
    deleteBlankLines(): void
    {
        let selection = this.getSelection(),
            anchor = selection.anchor,
            doc = vscode.window.activeTextEditor.document,
            range = doc.lineAt(selection.start.line).range,
            promises = [],
            nextLine: vscode.Position;

        if (range.isEmpty)
        {
            range = this.getFirstBlankLine(range);
            anchor = range.start;
            nextLine = range.start;
        } else
        {
            nextLine = range.start.translate(1, 0);
        }
        selection = new vscode.Selection(nextLine, nextLine);
        vscode.window.activeTextEditor.selection = selection;
        for (let line = selection.start.line;
            line < doc.lineCount - 1 && doc.lineAt(line).range.isEmpty;
            ++line)
        {
            promises.push(vscode.commands.executeCommand("deleteRight"));
        }
        Promise.all(promises).then(() =>
        {
            vscode.window.activeTextEditor.selection = new vscode.Selection(anchor, anchor);
        });
    }

    /**
     * 
     * @param range 
     */
    static delete(range: vscode.Range = null): Thenable<boolean>
    {
        if (range === null)
        {
            let start = new vscode.Position(0, 0),
                doc = vscode.window.activeTextEditor.document,
                end = doc.lineAt(doc.lineCount - 1).range.end;

            range = new vscode.Range(start, end);
        }
        return vscode.window.activeTextEditor.edit(editBuilder =>
        {
            editBuilder.delete(range);
        });
    }

    /**
     * Set Register/Rectangle mode
     */
    setRMode(): void
    {
        this.setStatusBarMessage('RMode');
        this.keybindProgressMode = KeybindProgressMode.RMode;
        return;
    }

    /**
     * Set Abbrev mode
     */
    setAMode(): void
    {
        if (this.abbrevMode)
        {
            this.setStatusBarMessage('AMode');
            this.keybindProgressMode = KeybindProgressMode.AMode;
        }
        return;
    }

    /**
     * Set Rectangle/Register mode
     */
    setUniversalArg(arg: string): void
    {
        this.universalArg = arg;
        return;
    }

    /**
     * Called when a key is pressed via registering the 'type' command in extension.js
     * @param text the key pressed
     */
    onType(text: string): void
    {
        let fHandled = true;
        switch (this.keybindProgressMode)
        {
            case KeybindProgressMode.AMode:
                switch (text)
                {
                    case 'g':
                        this.emacsGlobalAbbrev();
                        this.keybindProgressMode = KeybindProgressMode.None;
                        break;

                    case 'i':
                        this.keybindProgressMode = KeybindProgressMode.AModeI;
                        break;
                }
                break;

            case KeybindProgressMode.AModeI:
                this.emacsInverseGlobalAbbrev();
                this.keybindProgressMode = KeybindProgressMode.None;
                break;

            case KeybindProgressMode.RMode:
                switch (text)
                {
                    // Rectangles
                    case 'r':
                        this.keybindProgressMode = KeybindProgressMode.RModeR;
                        break;

                    case 'k':
                        this.emacsRectangle('k');
                        this.keybindProgressMode = KeybindProgressMode.None;
                        break;

                    case 'N':
                        this.emacsRectangle('N');
                        this.keybindProgressMode = KeybindProgressMode.None;
                        break;

                    case 'd':
                        this.emacsRectangle('d');
                        this.keybindProgressMode = KeybindProgressMode.None;
                        break;

                    case 'y':
                        this.emacsRectangle('y');
                        this.keybindProgressMode = KeybindProgressMode.None;
                        break;

                    case 'o':
                        this.emacsRectangle('o');
                        this.keybindProgressMode = KeybindProgressMode.None;
                        break;

                    case 'c':
                        this.emacsRectangle('c');
                        this.keybindProgressMode = KeybindProgressMode.None;
                        break;

                    case 't':
                        this.emacsRectangle('t');
                        this.keybindProgressMode = KeybindProgressMode.None;
                        break;

                    // Registers
                    case ' ':
                        this.keybindProgressMode = KeybindProgressMode.RModeP;
                        break;

                    case 'j':
                        this.keybindProgressMode = KeybindProgressMode.RModeJ;
                        break;

                    case 's':
                        this.keybindProgressMode = KeybindProgressMode.RModeS;
                        break;

                    case 'i':
                        this.keybindProgressMode = KeybindProgressMode.RModeI;
                        break;

                    default:
                        fHandled = false;
                        break;
                }
                break;

            case KeybindProgressMode.RModeP:
                this.SavePositionToRegister(text);
                this.keybindProgressMode = KeybindProgressMode.None;
                break;

            case KeybindProgressMode.RModeS:
                this.SaveTextToRegister(text);
                this.keybindProgressMode = KeybindProgressMode.None;
                break;

            case KeybindProgressMode.RModeR:
                this.SaveRectangleToRegister(text);
                this.keybindProgressMode = KeybindProgressMode.None;
                break;

            case KeybindProgressMode.RModeJ:
                this.RestorePositionFromRegister(text);
                this.keybindProgressMode = KeybindProgressMode.None;
                break;

            case KeybindProgressMode.RModeI:
                this.RestoreTextFromRegister(text);
                this.keybindProgressMode = KeybindProgressMode.None;
                break;

            case KeybindProgressMode.AMode: // not supported [yet]
            case KeybindProgressMode.MacroRecordingMode: // not supported [yet]
            case KeybindProgressMode.None:
            default:
                this.keybindProgressMode = KeybindProgressMode.None;
                if (this.abbrevMode)
                {
                    fHandled = this.emacsMatchAbbrev(text);
                }
                else
                {
                    fHandled = false;
                }
                break;
        }

        if (!fHandled)
        {
            // default input handling: pass control to VSCode
            vscode.commands.executeCommand('default:type', {
                text: text
            });
        }

        this.setUniversalArg('0');
        return;
    }

    deleteRectangle = (builder: vscode.TextEditorEdit, tl: vscode.Position, br: vscode.Position) =>
    {
        for (var l = tl.line; l < (br.line + 1); l++)
        {
            builder.delete(new vscode.Range(new vscode.Position(l, tl.character), new vscode.Position(l, br.character)));
        }
    }

    stringRectangle = (builder: vscode.TextEditorEdit, sel: vscode.Selection, str: string) =>
    {
        for (var l = sel.start.line; l < (sel.end.line + 1); l++)
        {
            builder.insert(new vscode.Position(l, sel.start.character), str);
        }
    }

    numberRectangle = (builder: vscode.TextEditorEdit, sel: vscode.Selection) =>
    {
        let numLines = sel.end.line - sel.start.line
        let log10NumLines = Math.log10(numLines)
        let numDigits = Math.floor(log10NumLines) + 1
        let pad = Array(numDigits).join(' ')
        for (let l = sel.start.line, count = 1; l < (sel.end.line + 1); l++ , count++)
        {
            let nstr = (pad + count.toString()).slice(-numDigits) + " "
            builder.insert(new vscode.Position(l, sel.start.character), nstr);
        }
    }

    yankRectangle = (builder: vscode.TextEditorEdit, pt: vscode.Position, rect: RectangleContent) =>
    {
        let line = pt.line;
        for (let txt of rect.getContent())
        {
            builder.insert(pt.with(line++, pt.character), txt);
        }
    }

    emacsGlobalAbbrev = () =>
    {
        let editor = vscode.window.activeTextEditor;
        let sel = this.getSelection();
        let range = new vscode.Range(sel.end.with(Math.max(sel.end.line-10, 1), sel.end.character), sel.end);
        let selectedText = vscode.window.activeTextEditor.document.getText(range);

        let pat = '.*?(\\S+' + Array(parseInt(this.universalArg)).join('\\s+\\S+') + ')$';
        var re = new RegExp(pat);
        let match = selectedText.match(re);
        let expansion = match[1];
        this.setStatusBarMessage("Expansion is "+expansion);
        vscode.window.showInputBox({ prompt: 'Global abbrev for ' + expansion + ':' })
            .then(
            str =>
            {
                this.abbrevs[str] = expansion;
            });
    }

    emacsInverseGlobalAbbrev = () =>
    {
        let editor = vscode.window.activeTextEditor;
        let sel = this.getSelection();
        let range = new vscode.Range(sel.end.with(Math.max(sel.end.line-10, 1), sel.end.character), sel.end);
        let selectedText = vscode.window.activeTextEditor.document.getText(range);

        let pat = '.*?(\\S+)$';
        var re = new RegExp(pat);
        let match = selectedText.match(re);
        let abbrev = match[1];
        this.setStatusBarMessage("Abbrev is "+abbrev);
        vscode.window.showInputBox({ prompt: 'Global expansion for ' + abbrev + ':' })
            .then(
            str =>
            {
                this.abbrevs[abbrev] = str;
            });
    }

    emacsMatchAbbrev = (text: string) : boolean =>
    {
        let editor = vscode.window.activeTextEditor;
        let sel = this.getSelection();
        let range = new vscode.Range(sel.end.with(Math.max(sel.end.line-10, 1), sel.end.character), sel.end);
        let selectedText = vscode.window.activeTextEditor.document.getText(range) + text;

        let pat = '.*?(\\S+)([\\s\\W_])$';
        var re = new RegExp(pat);
        let match = selectedText.match(re);

        if (match == null || match.length != 3)
        {
            return false;
        }

        let abbrev = match[1];
        let trailingWhiteSpace = match[2];

        if (abbrev in this.abbrevs)
        {
            editor.edit(editBuilder =>
            {
                editBuilder.delete(sel.with(sel.start.with(sel.start.line, sel.start.character - abbrev.length), sel.end));
                editBuilder.insert(sel.start, this.abbrevs[abbrev] + trailingWhiteSpace);
            });
            return true;
        }

        return false;
    }

    emacsRectangle = (op: string) =>
    {
        let editor = vscode.window.activeTextEditor;
        let sel = this.getSelection();

        switch (op)
        {
            case 't':
                vscode.window.showInputBox({ prompt: 'String rectangle (default ' + this.lastRectString + ') :' })
                    .then(
                    str =>
                    {
                        vscode.window.activeTextEditor.edit(builder =>
                        {
                            if (str == '')
                            {
                                str = this.lastRectString;
                            }
                            this.deleteRectangle(builder, sel.start, sel.end);
                            this.stringRectangle(builder, sel, str);
                            this.lastRectString = str;
                        });
                    }
                    );
                break;
            case 'o':
                vscode.window.activeTextEditor.edit(builder =>
                {
                    let str = Array(Math.abs(sel.start.character - sel.end.character) + 1).join(" ")
                    this.stringRectangle(builder, sel, str);
                });
                break;
            case 'N':
                vscode.window.activeTextEditor.edit(builder =>
                {
                    this.numberRectangle(builder, sel);
                });
                break;
            case 'c':
                vscode.window.activeTextEditor.edit(builder =>
                {
                    let str = Array(Math.abs(sel.start.character - sel.end.character) + 1).join(" ")
                    this.deleteRectangle(builder, sel.start, sel.end);
                    this.stringRectangle(builder, sel, str);
                });
                break;
            case 'k':
                vscode.window.activeTextEditor.edit(builder =>
                {
                    this.killRect = RectangleContent.fromSelection(editor);
                    this.deleteRectangle(builder, sel.start, sel.end);
                });

                vscode.commands.executeCommand("emacs.exitMarkMode"); // emulate Emacs 
                break;
            case 'd':
                vscode.window.activeTextEditor.edit(builder =>
                {
                    this.deleteRectangle(builder, sel.start, sel.end);
                });

                vscode.commands.executeCommand("emacs.exitMarkMode"); // emulate Emacs 
                break;
            case 'y':
                vscode.window.activeTextEditor.edit(editBuilder =>
                {
                    this.yankRectangle(editBuilder, this.getSelection().start, this.killRect);
                });
                vscode.commands.executeCommand("emacs.exitMarkMode"); // emulate Emacs 
                break;
        }

        vscode.commands.executeCommand("emacs.exitMarkMode");
    }

    /**
     * View register content
     */
    ViewRegister(registerName: string): string
    {
        return "Not implemented"
    }

    /**
     * Store the text contained in the currently selected rectangle into a register
     * @param registerName Name of register in which to store rectangle
     */
    SaveRectangleToRegister(registerName: string): void
    {
        if (null == registerName)
        {
            return;
        }
        var editor = vscode.window.activeTextEditor;
        var sel = this.getSelection();
        vscode.window.activeTextEditor.edit(builder =>
        {
            this.registersStorage[registerName] = RegisterContent.fromRectangle(RectangleContent.fromSelection(editor));
        });
        vscode.commands.executeCommand("emacs.exitMarkMode"); // emulate Emacs 
        return;
    }

    /**
     * Save the current position of the cursor/point into a register
     * @param registerName Name of register in which to store current position
     */
    SavePositionToRegister(registerName: string): void
    {
        vscode.commands.executeCommand("emacs.exitMarkMode"); // emulate Emacs 
        if (null == registerName)
        {
            return;
        }

        var editor = vscode.window.activeTextEditor;
        const position = editor.selection.active;
        this.registersStorage[registerName] = RegisterContent.fromPoint(position);
        return;
    }

    /**
     * Store the selected text into a register
     * @param registerName Name of register in which to store text
     */
    SaveTextToRegister(registerName: string): void
    {
        if (null == registerName)
        {
            return;
        }
        let range: vscode.Range = this.getSelectionRange();
        if (range !== null)
        {
            let selectedText = vscode.window.activeTextEditor.document.getText(range);
            if (null !== selectedText)
            {
                this.registersStorage[registerName] = RegisterContent.fromRegion(selectedText);
            }
        }
        vscode.commands.executeCommand("emacs.exitMarkMode"); // emulate Emacs 
        return;
    }

    /**
     * Move cursor/point to position stored in register
     * @param registerName Name of register containing the target position
     */
    RestorePositionFromRegister(registerName: string): void
    {
        vscode.commands.executeCommand("emacs.exitMarkMode"); // emulate Emacs 
        let obj: RegisterContent = this.registersStorage[registerName];
        if (null == obj)
        {
            this.setStatusBarMessage("Register is empty.");
            return;
        }
        if (RegisterKind.KPoint === obj.getRegisterKind())
        {
            const content: string | vscode.Position | RectangleContent = obj.getRegisterContent();
            if (content instanceof vscode.Position)
            {
                var editor = vscode.window.activeTextEditor;
                editor.selection = new vscode.Selection(content, content);
            }
        }
        return;
    }

    /**
     * Insert text or rectangle from register into buffer
     * @param registerName Name of register containing the text to be inserted
     */
    RestoreTextFromRegister(registerName: string): void
    {
        vscode.commands.executeCommand("emacs.exitMarkMode"); // emulate Emacs 
        let obj: RegisterContent = this.registersStorage[registerName];
        if (null == obj)
        {
            this.setStatusBarMessage("Register is empty.");
            return;
        }
        if (RegisterKind.KText === obj.getRegisterKind())
        {
            const content: string | vscode.Position | RectangleContent = obj.getRegisterContent();
            if (typeof content === 'string')
            {
                vscode.window.activeTextEditor.edit(editBuilder =>
                {
                    editBuilder.insert(this.getSelection().active, content);
                });
            }
        }
        if (RegisterKind.KRectangle === obj.getRegisterKind())
        {
            const content: string | vscode.Position | RectangleContent = obj.getRegisterContent();
            if (content instanceof RectangleContent)
            {
                vscode.window.activeTextEditor.edit(editBuilder =>
                {
                    this.yankRectangle(editBuilder, this.getSelection().start, content);
                });
            }
        }
        return;
    }

    /**
     * Support recentering:
     * https://www.gnu.org/software/emacs/manual/html_node/emacs/Recentering.html
     * 
     * Code from Leaping Frog Studios version of the extension:
     * https://marketplace.visualstudio.com/items?itemName=lfs.vscode-emacs-friendly
     */
    scrollLineToCenterTopBottom = () =>
    {
        const editor = vscode.window.activeTextEditor
        const selection = editor.selection

        switch (this.centerState)
        {
            case RecenterPosition.Middle:
                this.centerState = RecenterPosition.Top;
                editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
                break;
            case RecenterPosition.Top:
                this.centerState = RecenterPosition.Bottom;
                editor.revealRange(selection, vscode.TextEditorRevealType.AtTop);
                break;
            case RecenterPosition.Bottom:
                this.centerState = RecenterPosition.Middle;
                // There is no AtBottom, so instead scroll a page up (without moving cursor).
                // The current line then ends up as the last line of the window (more or less)
                vscode.commands.executeCommand("scrollPageUp");
                break;
        }
    }

}
