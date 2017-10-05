import {Editor} from './editor';

export class Operation {
    private editor: Editor;
    private commandList: { [key: string]: (...args: any[]) => any, thisArgs?: any } = {};

    constructor() {
        this.editor = new Editor();
        this.commandList = {
            'C-k': () => {
                this.editor.kill();
            },
            'C-w': () => {
                if (this.editor.cut()) {
                    this.editor.setStatusBarMessage("Cut");
                } else {
                    this.editor.setStatusBarMessage("Cut Error!");
                }
            },
            'M-w': () => {
                if (this.editor.copy()) {
                    this.editor.setStatusBarMessage("Copy");
                } else {
                    this.editor.setStatusBarMessage("Copy Error!");
                }
            },
            'C-y': () => {
                if(this.editor.yank()) {
                    this.editor.setStatusBarMessage("Yank");
                } else {
                    this.editor.setStatusBarMessage("Kill ring is empty");
                }
            },
            "C-x_C-o": () => {
                this.editor.deleteBlankLines();
            },
            "C-x_u": () => {
                this.editor.undo();
                this.editor.setStatusBarMessage("Undo!");
            },
            "C-/": () => {
                this.editor.undo();
                this.editor.setStatusBarMessage("Undo!");
            },
            'C-g': () => {
                this.editor.setStatusBarMessage("Quit");
            },
            'C-l': () => {
                this.editor.scrollLineToCenterTopBottom()
            },
            "C-x_r": () => {
                this.editor.setRMode();
            },
            "C-x_a": () => {
                this.editor.setAMode();
            },
            "C-u_-": () => {
                this.editor.setUniversalArg('-');
            },
            "C-u_1": () => {
                this.editor.setUniversalArg('1');
            },
            "C-u_2": () => {
                this.editor.setUniversalArg('2');
            },
            "C-u_3": () => {
                this.editor.setUniversalArg('3');
            },
            "enable-abbrev": () => {
                this.editor.abbrevMode = true;
            },
            "disable-abbrev": () => {
                this.editor.abbrevMode = false;
            }
        };
    }

    getCommand(commandName: string): (...args: any[]) => any {
        return this.commandList[commandName];
    }

    onType(text: string): void {
        this.editor.onType(text);
    }
}
