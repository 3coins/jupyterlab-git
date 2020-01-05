import { Dialog, showDialog } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import * as React from 'react';
import { classes } from 'typestyle';
import { GitExtension } from '../model';
import {
  disabledFileStyle,
  discardFileButtonSelectedStyle,
  expandedFileStyle,
  fileButtonStyle,
  fileChangedLabelBrandStyle,
  fileChangedLabelInfoStyle,
  fileChangedLabelStyle,
  fileGitButtonStyle,
  fileIconStyle,
  fileLabelStyle,
  fileStyle,
  selectedFileChangedLabelStyle,
  selectedFileStyle,
  sideBarExpandedFileLabelStyle
} from '../style/FileItemStyle';
import {
  changeStageButtonStyle,
  diffFileButtonStyle,
  discardFileButtonStyle
} from '../style/GitStageStyle';
import { Git } from '../tokens';
import {
  extractFilename,
  openListedFile,
  parseFileExtension,
  parseSelectedFileExtension
} from '../utils';
import { isDiffSupported } from './diff/Diff';
import { openDiffView } from './diff/DiffWidget';
import { ISpecialRef } from './diff/model';

// Git status codes https://git-scm.com/docs/git-status
export const STATUS_CODES = {
  M: 'Modified',
  A: 'Added',
  D: 'Deleted',
  R: 'Renamed',
  C: 'Copied',
  U: 'Updated',
  '?': 'Untracked',
  '!': 'Ignored'
};

export interface IFileItemProps {
  file: Git.IStatusFileResult;
  stage: string;
  model: GitExtension;
  moveFile: (file: string) => Promise<void>;
  discardFile: (file: string) => Promise<void>;
  moveFileIconClass: string;
  moveFileIconSelectedClass: string;
  moveFileTitle: string;
  contextMenu: (
    event: any,
    typeX: string,
    typeY: string,
    file: string,
    index: number,
    stage: string
  ) => void;
  selectedFile: number;
  updateSelectedFile: (file: number, stage: string) => void;
  fileIndex: number;
  selectedStage: string;
  selectedDiscardFile: number;
  updateSelectedDiscardFile: (index: number) => void;
  disableFile: boolean;
  toggleDisableFiles: () => void;
  renderMime: IRenderMimeRegistry;
}

export class FileItem extends React.Component<IFileItemProps, {}> {
  constructor(props: IFileItemProps) {
    super(props);
  }

  checkSelected(): boolean {
    return (
      this.props.selectedFile === this.props.fileIndex &&
      this.props.selectedStage === this.props.stage
    );
  }

  getFileChangedLabel(change: keyof typeof STATUS_CODES): string {
    return STATUS_CODES[change];
  }

  showDiscardWarning(): boolean {
    return (
      this.props.selectedDiscardFile === this.props.fileIndex &&
      this.props.stage === 'Changed'
    );
  }

  getFileChangedLabelClass(change: string) {
    if (change === 'M') {
      if (this.showDiscardWarning()) {
        return classes(fileChangedLabelStyle, fileChangedLabelBrandStyle);
      } else {
        return this.checkSelected()
          ? classes(
              fileChangedLabelStyle,
              fileChangedLabelBrandStyle,
              selectedFileChangedLabelStyle
            )
          : classes(fileChangedLabelStyle, fileChangedLabelBrandStyle);
      }
    } else {
      if (this.showDiscardWarning()) {
        return classes(fileChangedLabelStyle, fileChangedLabelInfoStyle);
      } else {
        return this.checkSelected()
          ? classes(
              fileChangedLabelStyle,
              fileChangedLabelInfoStyle,
              selectedFileChangedLabelStyle
            )
          : classes(fileChangedLabelStyle, fileChangedLabelInfoStyle);
      }
    }
  }

  getFileLabelIconClass() {
    if (this.showDiscardWarning()) {
      return classes(fileIconStyle, parseFileExtension(this.props.file.to));
    } else {
      return this.checkSelected()
        ? classes(fileIconStyle, parseSelectedFileExtension(this.props.file.to))
        : classes(fileIconStyle, parseFileExtension(this.props.file.to));
    }
  }

  getFileClass() {
    if (!this.checkSelected() && this.props.disableFile) {
      return classes(fileStyle, disabledFileStyle);
    } else if (this.showDiscardWarning()) {
      classes(fileStyle, expandedFileStyle);
    } else {
      return this.checkSelected()
        ? classes(fileStyle, selectedFileStyle)
        : classes(fileStyle);
    }
  }

  getFileLabelClass() {
    return classes(fileLabelStyle, sideBarExpandedFileLabelStyle);
  }

  getMoveFileIconClass() {
    if (this.showDiscardWarning()) {
      return classes(
        fileButtonStyle,
        changeStageButtonStyle,
        fileGitButtonStyle,
        this.props.moveFileIconClass
      );
    } else {
      return this.checkSelected()
        ? classes(
            fileButtonStyle,
            changeStageButtonStyle,
            fileGitButtonStyle,
            this.props.moveFileIconSelectedClass
          )
        : classes(
            fileButtonStyle,
            changeStageButtonStyle,
            fileGitButtonStyle,
            this.props.moveFileIconClass
          );
    }
  }

  getDiffFileIconClass() {
    return classes(
      fileButtonStyle,
      changeStageButtonStyle,
      fileGitButtonStyle,
      diffFileButtonStyle
    );
  }

  getDiscardFileIconClass() {
    if (this.showDiscardWarning()) {
      return classes(
        fileButtonStyle,
        changeStageButtonStyle,
        fileGitButtonStyle,
        discardFileButtonStyle
      );
    } else {
      return this.checkSelected()
        ? classes(
            fileButtonStyle,
            changeStageButtonStyle,
            fileGitButtonStyle,
            discardFileButtonSelectedStyle
          )
        : classes(
            fileButtonStyle,
            changeStageButtonStyle,
            fileGitButtonStyle,
            discardFileButtonStyle
          );
    }
  }

  /**
   * Callback method discarding unstaged changes for selected file.
   * It shows modal asking for confirmation and when confirmed make
   * server side call to git checkout to discard changes in selected file.
   */
  async discardSelectedFileChanges() {
    this.props.toggleDisableFiles();
    this.props.updateSelectedDiscardFile(this.props.fileIndex);
    const result = await showDialog({
      title: 'Discard changes',
      body: `Are you sure you want to permanently discard changes to ${
        this.props.file.from
      }? This action cannot be undone.`,
      buttons: [Dialog.cancelButton(), Dialog.warnButton({ label: 'Discard' })]
    });
    if (result.button.accept) {
      this.props.discardFile(this.props.file.to);
    }
    this.props.toggleDisableFiles();
    this.props.updateSelectedDiscardFile(-1);
  }

  render() {
    const status =
      this.getFileChangedLabel(this.props.file.y as any) ||
      this.getFileChangedLabel(this.props.file.x as any);

    return (
      <li
        className={this.getFileClass()}
        onClick={() =>
          this.props.updateSelectedFile(this.props.fileIndex, this.props.stage)
        }
        onContextMenu={e => {
          this.props.contextMenu(
            e,
            this.props.file.x,
            this.props.file.y,
            this.props.file.to,
            this.props.fileIndex,
            this.props.stage
          );
        }}
        onDoubleClick={() =>
          openListedFile(
            this.props.file.x,
            this.props.file.y,
            this.props.file.to,
            this.props.model
          )
        }
        title={`${this.props.file.to} ● ${status}`}
      >
        <span className={this.getFileLabelIconClass()} />
        <span className={this.getFileLabelClass()}>
          {extractFilename(this.props.file.to)}
        </span>
        {this.props.stage === 'Changed' && (
          <React.Fragment>
            <button
              className={`jp-Git-button ${this.getDiscardFileIconClass()}`}
              title={'Discard changes'}
              onClick={(
                event: React.MouseEvent<HTMLButtonElement, MouseEvent>
              ) => {
                event.stopPropagation();
                this.discardSelectedFileChanges();
              }}
            />
            {isDiffSupported(this.props.file.to) &&
              this.diffButton({ specialRef: 'WORKING' })}
          </React.Fragment>
        )}
        {this.props.stage === 'Staged' &&
          isDiffSupported(this.props.file.to) &&
          this.diffButton({ specialRef: 'INDEX' })}
        <button
          className={`jp-Git-button ${this.getMoveFileIconClass()}`}
          title={this.props.moveFileTitle}
          onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            event.stopPropagation();
            this.props.moveFile(this.props.file.to);
          }}
        />
        <span className={this.getFileChangedLabelClass(this.props.file.y)}>
          {this.props.file.y === '?'
            ? 'U'
            : this.props.file.y.trim() || this.props.file.x}
        </span>
      </li>
    );
  }

  /**
   * Creates a button element which is used to request diff from within the
   * Git panel.
   *
   * @param currentRef the ref to diff against the git 'HEAD' ref
   */
  private diffButton(currentRef: ISpecialRef): JSX.Element {
    return (
      <button
        className={`jp-Git-button ${this.getDiffFileIconClass()}`}
        title={'Diff this file'}
        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
          event.stopPropagation();
          openDiffView(
            this.props.file.to,
            this.props.model,
            {
              previousRef: { gitRef: 'HEAD' },
              currentRef: { specialRef: currentRef.specialRef }
            },
            this.props.renderMime
          ).catch(reason => {
            console.error(
              `Fail to open diff view for ${this.props.file.to}.\n${reason}`
            );
          });
        }}
      />
    );
  }
}
