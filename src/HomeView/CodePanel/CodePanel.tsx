import React, { useRef, useEffect } from "react";
import { useStyles } from "./style";
import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { languageDef, themeDef, configuration } from "./customLang";
import { useRecoilState, useRecoilValue } from "recoil";
import { treeAtom, settingsAtom } from "../../store";
import {
  BRANCH,
  LAST_BRANCH,
  TRUNK,
  getBranchPrefixAccurate,
  trimTreeLine,
  getNumberOfTabs,
  getNumberOfLeadingTabs,
} from "../../tree";
import { TreeType, treeJsonToString, treeStringToJson } from "@structure-codes/utils";

// import { customTreeFolding } from "./foldProvider";
declare global {
  interface Window {
    editor: any;
    treeStringToJson: any;
  }
}

type IGlobalEditorOptions = monaco.editor.IGlobalEditorOptions;
type IEditorOptions = monaco.editor.IEditorOptions;
type Monaco = typeof monaco;

export const options: IGlobalEditorOptions | IEditorOptions = {
  tabSize: 2,
  insertSpaces: false,
  minimap: {
    enabled: false,
  },
  readOnly: true,
};

const getLastNode = (branch: TreeType) => {
  const indexes: Array<number> = [];
  // Get the last line number that is a child of the given branch
  const getIndexes = (branch: TreeType) => {
    if (branch.children.length === 0) indexes.push(branch._index);
    branch.children.forEach((child) => {
      getIndexes(child);
    });
  };
  getIndexes(branch);
  return Math.max(...indexes);
};

export const CodePanel = React.memo(({ height }: { height: number }) => {
  const classes = useStyles();
  const treeRef = useRef<string | null>(null);
  const editorRef = useRef<any>(null);
  const [treeState, setTreeState] = useRecoilState(treeAtom);
  const settingsState = useRecoilValue(settingsAtom);

  useEffect(() => {
    const newValue = treeJsonToString({
      tree: treeState,
      tabChar: "\t",
      options: settingsState,
    });
    treeRef.current = newValue;
    const currValue = editorRef.current?.getModel()?.getValue();
    if (currValue !== newValue) {
      editorRef.current?.getModel()?.setValue(newValue)
    };
  }, [treeState, settingsState]);


  const onMount = (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    // Register a new language
    monaco.languages.register({ id: "tree" });
    // Register a tokens provider for the language
    monaco.languages.setMonarchTokensProvider("tree", languageDef);
    // Set the editing configuration for the language
    monaco.languages.setLanguageConfiguration("tree", configuration);
    monaco.editor.defineTheme("treeTheme", themeDef);
    monaco.editor.setTheme("treeTheme");
    editor.focus();
    
    // register code folder provider
    monaco.languages.registerFoldingRangeProvider("tree", {
      provideFoldingRanges: function (model, context, token) {
        const tree: TreeType[] = treeStringToJson(model.getValue());
        const ranges: any = [];
        if (tree.length === 0) return ranges;
        
        const getRanges = (branch: TreeType) => {
          const startIndex = branch._index;
          const endIndex = getLastNode(branch);
          ranges.push({ start: startIndex + 1, end: endIndex +  1 });
          branch.children.forEach((leaf) => {
            getRanges(leaf);
          });
        };
        
        tree.forEach((branch: TreeType) => {
          getRanges(branch);
        });
        
        return ranges;
      },
    });
    
    // editor.onDidChangeModelContent(e => handleEditorChange(e, editor));
    // editor.onDidChangeCursorPosition(e => {
    //   console.log(`cursor move source: ${e.source}`);
    //   console.log(`cursor move position: ${e.position}`);
    //   // If selecting text or api moves cursor, no need to revalidate cursor position
    //   const selection = editor.getSelection();
    //   const isSelecting = selection?.endColumn !== selection?.startColumn || selection?.endLineNumber !== selection?.startLineNumber;
    //   if (e.source === "mouse" && isSelecting) return;
    //   if (e.source === "api") return;
    //   const value = editor.getModel()?.getValue() || "";
    //   const currentLine = value.split(/\r?\n/)[e.position.lineNumber - 1];
    //   const currentPrefix = currentLine.split(" ")[0];
    //   if (e.position.column < currentPrefix.length + 2) {
    //     editor.setPosition({
    //       lineNumber: e.position.lineNumber,
    //       column: currentPrefix.length + 2,
    //     });
    //   }
    // });

    editor
      .getModel()
      ?.setValue(treeRef.current || "");
    editorRef.current = editor;
  };

  const handleEditorChange = (
    e: monaco.editor.IModelContentChangedEvent,
    editor: monaco.editor.IStandaloneCodeEditor
  ) => {
    const model = editor.getModel();
    if (!model) return;
    const value = model.getValue();
    if (!value) return model.setValue(getBranchPrefixAccurate([], true));
    const changes = e.changes[0];
    const isBackspace = changes.text === "" && changes.range.startColumn < changes.range.endColumn;

    let prevPrefix = TRUNK;
    let currPrefix = prevPrefix;

    const branchPrefixRegexWithSpaces = /^(\t+)?(│|├──|└──|\t)+ /g;

    const branchPrefixRegex = new RegExp(
      `^(${TRUNK}?\t)+${BRANCH}|^(${TRUNK}?\t)+${LAST_BRANCH}|^${LAST_BRANCH}|^${BRANCH}`,
      "g"
    );

    const getUpdatedLines = (lines: string[]) => {
      const updated: (string | null)[] = lines.map(line => {
        prevPrefix = currPrefix;
        const matches = line.match(branchPrefixRegex);
        currPrefix = matches ? matches[0] : BRANCH;
        const lineContent = trimTreeLine(line.substr(currPrefix.length));

        // Handle moving tree right with tabs
        if (lineContent.match(/^\t/)) {
          const prevNumTabs = getNumberOfTabs(prevPrefix);
          const numTabs = getNumberOfTabs(currPrefix) + getNumberOfLeadingTabs(lineContent);
          if (numTabs - prevNumTabs > 1)
            return (
              getBranchPrefixAccurate(Array(prevNumTabs + 1).fill(true), false) +
              lineContent.replace("\t", "")
            );
          return (
            getBranchPrefixAccurate(Array(numTabs).fill(true), false) +
            lineContent.replace("\t", "")
          );
        }

        // Return current line if the line starts with an acceptable prefix
        // EX: │\t├──
        if (line.match(branchPrefixRegexWithSpaces)) {
          return line;
        }

        // Handle backspace
        if (isBackspace) {
          const tabCount = getNumberOfTabs(currPrefix);
          if (tabCount === 0) return null;
          const newPrefix = getBranchPrefixAccurate(Array(tabCount - 1).fill(true), false);
          editor.setPosition({
            lineNumber: changes.range.endLineNumber,
            column: 1,
          });
          return newPrefix + lineContent;
        }

        // // Handle hitting enter
        // if (!line.match(branchPrefixRegex)) {
        //   console.log("handleEnter?");
        //   const newLine = prevPrefix + " " + line;
        //   const curr = editorRef.current.getPosition();
        //   if (curr) {
        //     const newPosition = {
        //       lineNumber: curr.lineNumber + 1,
        //       column: 100,
        //     };
        //     editorRef.current.setPosition(newPosition);
        //   }
        //   return prevPrefix + " " + line;
        // }
        return line;
      });
      return updated;
    };
    const lines: string[] = value.split(/\r?\n/);
    const updated: any = getUpdatedLines(lines).filter((line: string | null) => line !== null);
    const newValue = updated?.join("\n") || getBranchPrefixAccurate([], true);
    if (newValue !== treeRef.current) {
      const newState: TreeType[] = treeStringToJson(newValue);
      setTreeState(newState);
    }
  };

  return (
    <div className={classes.codeContainer} style={{ height }}>
      <Editor options={options} theme="vs-dark" defaultLanguage="tree" onMount={onMount} />
    </div>
  );
});
