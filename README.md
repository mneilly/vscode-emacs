This is a fork of hiro-sun vscode-emacs that adds support for rectangles, registers and abbrev and C-l.

# vscode-emacs

vscode-emacs is an Emacs mode for Visual Studio Code. It supports common Emacs keybindings as well as the following features:
* regions
* kill ring
* rectangles
* registers

### Supported Rectangle Commands
|Command | Status | Desc |
|--------|--------|------|
| `C-x r k`   | OK | Kill the text of the region-rectangle, saving its contents as the last killed rectangle. |
| `C-x r M-w` | OK | Save the text of the region-rectangle as the last killed rectangle. |
| `C-x r d`   | OK | Delete the text of the region-rectangle. |
| `C-x r y`   | OK | Yank the last killed rectangle with its upper left corner at point. |
| `C-x r o`   | OK | Insert blank space to fill the space of the region-rectangle. This pushes the previous contents of the region-rectangle to the right. |
| `C-x r N`   | OK | Insert line numbers along the left edge of the region-rectangle. This pushes the previous contents of the region-rectangle to the right. |
| `C-x r c`   | OK | Clear the region-rectangle by replacing all of its contents with spaces. |
| `C-x r t string <RET>` | OK | Replace rectangle contents with string on each line. |

### Supported Register Commands
|Command | Status | Desc |
|--------|--------|------|
| `C-x r s r` | OK | Copy region into register r. |
| `C-x r i r` | OK | Insert text from register r. |
| `C-x r <SPC> r` | OK | Record the position of point and the current buffer in register r. |
| `C-x r j r` | OK | Jump to the position and buffer saved in register r. |
| `C-x r r r` | OK | Copy the region-rectangle into register r. With numeric argument, delete it as well. |
| `C-x r i r` | OK | Insert the rectangle stored in register r. |

### Abbrev Mode Support

Use C-S-p and search for abbrev to find the enable abbrev mode and disable abbrev mode commands.

|Command | Status | Desc |
|--------|--------|------|
| `C-x a g` | Buggy/Incomplete | Set abbrev for prior word (C-u not supported yet) |

## Operation
Use `Shift+DEL` to cut to clipboard, the `Ctrl+C` is not overridden.
Use `Shift+Insert` to paste from clipboard.

### Move command
|Command | Status | Desc |
|--------|--------|------|
| `C-f` | OK | Move forward |
| `C-b` | OK | Move backward |
| `C-n` | OK | Move to the next line |
| `C-p` | OK | Move to the previous line |
| `C-a` | OK | Move to the beginning of line |
| `C-e` | OK | Move to the end of line |
| `M-f` | OK | Move forward by one word unit |
| `M-b` | OK | Move backward by one word unit |
| `M->` | OK | Move to the end of buffer |
| `M-<` | OK | Move to the beginning of buffer |
| `C-v` | OK | Scroll down by one screen unit |
| `M-v` | OK | Scroll up by one screen unit |
| `C-x C-n` | - | Set goal column |
| `C-u C-x C-n` | - | Deactivate C-x C-n |
| `M-g g` | OK | Jump to line (command palette) |


### Search Command
|Command | Status | Desc |
|--------|--------|------|
| `C-s` | OK | Search forward |
| `C-r` | OK | Search backward |
| `C-M-n` | OK | Add selection to next find match |
| `C-l` | - | Use `ext install keyboard-scroll` to activate |

### Edit command
|Command | Status | Desc |
|--------|--------|------|
| `C-d` | OK | Delete right (DEL) |
| `C-h` | OK | Delete left (BACKSPACE) |
| `M-d` | OK | Delete word |
| `C-k` | OK | Kill to line end |
| `C-w` | OK | Kill region |
| `M-w` | OK | Copy region to kill ring |
| `C-y` | OK | Yank |
| `C-j` | OK | Line Feed |
| `C-m` | - | Carriage Return |
| `C-i` | - | Horizontal Tab |
| `C-x C-o` | OK | Delete blank lines around |
| `C-x h` | OK | Select All |
| `C-x u` (`C-/`)| OK | Undo |
| `C-;` | △ | Toggle line comment in and out |
| `M-;` | △ | Toggle region comment in and out |

### Other Command
|Command | Status | Desc |
|--------|--------|------|
| `C-g` | OK | Cancel |
| `C-space` | OK | Set mark |
| `C-\` | - | IME control |
| `C-quote` | OK | IntelliSense Suggestion |
| `C-doublequote` | △ | IntelliSense Parameter Hint |
| `M-x` | OK | Open command palette |
| `M-/(dabbrev)` | - | Auto-completion |
| `M-num command` | - | Repeat command `num` times |
| `C-M-SPC` | OK | Toggle SideBar visibility |

### File Command
|Command | Status | Desc |
|--------|--------|------|
| `C-o` | OK | Open a file |
| `C-x b` | OK | QuickOpen a file |
| `C-x C-f` | OK | Open a working directory |
| `C-x C-s` | OK | Save |
| `C-x C-w` | OK | Save as |
| `C-x i` | - | Insert buffer from file |
| `C-x C-d` | - | Open Folder |
| `C-x C-n` | - | Open new window |
| `C-x C-b` | - | Create new file and open |

## Conflicts with default key bindings
- `ctrl+d`: editor.action.addSelectionToNextFindMatch => **Use `ctrl+alt+n` instead**;
- `ctrl+g`: workbench.action.gotoLine => **Use `alt+g g` instead**;
- `ctrl+b`: workbench.action.toggleSidebarVisibility => **Use `ctrl+alt+space` instead**;
- `ctrl+space`: toggleSuggestionDetails, editor.action.triggerSuggest => **Use `ctrl+'` instead**;
- `ctrl+x`: editor.action.clipboardCutAction => **Use `shift+delete` instead**;
- `ctrl+v`: editor.action.clipboardPasteAction => **Use `shift+insert` instead**;
- `ctrl+k`: editor.debug.action.showDebugHover, editor.action.trimTrailingWhitespace, editor.action.showHover, editor.action.removeCommentLine, editor.action.addCommentLine, editor.action.openDeclarationToTheSide;
- `ctrl+y`: redo;
- `ctrl+m`: editor.action.toggleTabFocusMode;
- `ctrl+/`: editor.action.commentLine => **Use `ctrl+;` instead**;
- `ctrl+p` & `ctrl+e`: workbench.action.quickOpen => **Use `ctrl+x b` instead**;
- `ctrl+p`: workbench.action.quickOpenNavigateNext => **Use `ctrl+n` instead**.
