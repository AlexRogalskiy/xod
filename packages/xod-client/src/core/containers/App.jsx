import * as R from 'ramda';
import React from 'react';
import PropTypes from 'prop-types';
import $ from 'sanctuary-def';
import { Maybe, Either } from 'ramda-fantasy';
import {
  foldMaybe,
  foldEither,
  $Maybe,
  fail,
  explodeMaybe,
  catMaybies,
  maybeProp,
  enquote,
} from 'xod-func-tools';
import {
  Project,
  isValidIdentifier,
  IDENTIFIER_RULES,
  getPatchByPath,
  getProjectName,
} from 'xod-project';
import {
  transformProject,
  transpile,
  getNodeIdsMap,
  getNodePinKeysMap,
  getPinsAffectedByErrorRaisers,
  LIVENESS,
} from 'xod-arduino';

import { isInputTarget } from '../../utils/browser';
import { lowercaseKebabMask } from '../../utils/inputFormatting';
import sanctuaryPropType from '../../utils/sanctuaryPropType';

import PopupPrompt from '../../utils/components/PopupPrompt';
import PopupShowCode from '../../utils/components/PopupShowCode';
import PopupProjectPreferences from '../../project/components/PopupProjectPreferences';
import PopupPublishProject from '../../project/components/PopupPublishProject';

import * as actions from '../actions';
import { selectAll } from '../../editor/actions';
import {
  NO_PATCH_TO_TRANSPILE,
  SIMULATION_ALREADY_RUNNING,
} from '../../editor/messages';

import formatErrorMessage from '../formatErrorMessage';

export default class App extends React.Component {
  constructor(props) {
    super(props);

    this.transformProjectForTranspiler = this.transformProjectForTranspiler.bind(
      this
    );
    this.getGlobals = this.getGlobals.bind(this);

    /**
     * We have to handle some hotkeys, because:
     * - Browser IDE should prevent default event handling
     * - Electron IDE cannot handle some hotkeys correctly
     *   "...some keybindings cannot be overridden on Windows/Linux because they are hard-coded in Chrome."
     *   See details: https://github.com/electron/electron/issues/7165 and related issues
     */
    document.addEventListener('keydown', event => {
      // Prevent selecting all contents with "Ctrl+a" or "Command+a"
      const key = event.keyCode || event.which;
      const mod = event.metaKey || event.ctrlKey;

      // CmdOrCtrl+A
      if (mod && key === 65 && !isInputTarget(event)) {
        event.preventDefault();
        this.props.actions.selectAll();
      }
    });
  }
  componentDidMount() {
    document.addEventListener('cut', this.props.actions.cutEntities);
    document.addEventListener('copy', this.props.actions.copyEntities);
    document.addEventListener('paste', this.props.actions.pasteEntities);
    this.props.actions.fetchGrant(/* startup */ true);
  }

  onShowCodeArduino() {
    R.compose(
      foldEither(
        R.compose(
          this.props.actions.addError,
          R.when(R.is(Error), formatErrorMessage)
        ),
        this.props.actions.showCode
      ),
      R.map(transpile),
      this.transformProjectForTranspiler
    )(LIVENESS.NONE, {});
  }

  onRunSimulation() {
    if (this.props.isSimulationAbortable) {
      this.props.actions.addError(SIMULATION_ALREADY_RUNNING);
      return;
    }
    this.props.actions.runSimulationRequested();

    const eitherTProject = this.transformProjectForTranspiler(
      LIVENESS.SIMULATION,
      this.getGlobals()
    );

    R.compose(
      foldEither(
        R.compose(err => {
          this.props.actions.addError(err);
          this.props.actions.abortSimulation();
        }, R.when(R.is(Error), formatErrorMessage)),
        ({ code, nodeIdsMap, nodePinKeysMap, pinsAffectedByErrorRaisers }) =>
          this.props.actions.runSimulation(
            explodeMaybe(
              'currentPatchPath already folded in `transformProjectForTranspiler`',
              this.props.currentPatchPath
            ),
            nodeIdsMap,
            nodePinKeysMap,
            code,
            pinsAffectedByErrorRaisers
          )
      ),
      R.map(
        R.applySpec({
          code: transpile,
          nodeIdsMap: getNodeIdsMap,
          nodePinKeysMap: getNodePinKeysMap,
          pinsAffectedByErrorRaisers: tProj =>
            R.compose(
              foldMaybe(
                {},
                getPinsAffectedByErrorRaisers(tProj, R.__, this.props.project)
              ),
              R.chain(getPatchByPath(R.__, this.props.project))
            )(this.props.currentPatchPath),
        })
      )
    )(eitherTProject);
  }

  getGlobals() {
    return catMaybies({
      XOD_USERNAME: R.compose(R.map(enquote), R.chain(maybeProp('username')))(
        this.props.user
      ),
      XOD_PROJECT: R.compose(
        R.map(enquote),
        R.ifElse(R.length, Maybe.of, Maybe.Nothing),
        getProjectName
      )(this.props.project),
    });
  }

  transformProjectForTranspiler(liveness, globals) {
    try {
      return foldMaybe(
        Either.Left(NO_PATCH_TO_TRANSPILE),
        curPatchPath =>
          transformProject(this.props.project, curPatchPath, liveness, globals),
        this.props.currentPatchPath
      );
    } catch (unexpectedError) {
      // eslint-disable-next-line no-console
      console.error(unexpectedError);

      return fail('UNEXPECTED_ERROR', {
        message: unexpectedError.message,
      });
    }
  }

  renderPopupShowCode() {
    return (
      <PopupShowCode
        isVisible={this.props.popups.showCode}
        code={this.props.popupsData.showCode.code}
        onClose={this.props.actions.hideAllPopups}
      />
    );
  }

  renderPopupProjectPreferences() {
    return (
      <PopupProjectPreferences
        isVisible={this.props.popups.projectPreferences}
        project={this.props.project}
        onChange={this.props.actions.updateProjectMeta}
        onClose={this.props.actions.hideProjectPreferences}
      />
    );
  }

  renderPopupPublishProject() {
    return (
      <PopupPublishProject
        isVisible={this.props.popups.publishingProject}
        project={this.props.project}
        user={this.props.user}
        isPublishing={this.props.popupsData.publishingProject.isPublishing}
        onPublish={this.props.actions.publishProject}
        onRequestToEditPreferences={this.props.actions.showProjectPreferences}
        onClose={this.props.actions.cancelPublishingProject}
      />
    );
  }

  renderPopupCreateNewProject() {
    if (!this.props.popups.createProject) return null;

    return (
      <PopupPrompt
        title="Create new project"
        confirmText="Create project"
        isVisible={this.props.popups.createProject}
        onConfirm={this.onCreateProject}
        onClose={this.props.actions.hideAllPopups}
        inputMask={lowercaseKebabMask}
        inputValidator={isValidIdentifier}
        helpText={IDENTIFIER_RULES}
      >
        <p>Please, give a sonorous name to your project:</p>
      </PopupPrompt>
    );
  }

  render() {
    return <div />;
  }
}

App.propTypes = {
  project: sanctuaryPropType(Project),
  user: PropTypes.object,
  currentPatchPath: sanctuaryPropType($Maybe($.String)),
  popups: PropTypes.objectOf(PropTypes.bool),
  popupsData: PropTypes.objectOf(PropTypes.object),
  isSimulationAbortable: PropTypes.bool.isRequired,
  actions: PropTypes.shape({
    selectAll: PropTypes.func.isRequired,
    createProject: PropTypes.func.isRequired,
    updateProjectMeta: PropTypes.func.isRequired,
    hideAllPopups: PropTypes.func.isRequired,
    hideProjectPreferences: PropTypes.func.isRequired,
    cutEntities: PropTypes.func.isRequired,
    copyEntities: PropTypes.func.isRequired,
    pasteEntities: PropTypes.func.isRequired,
    /* eslint-disable react/no-unused-prop-types */
    requestPublishProject: PropTypes.func.isRequired,
    cancelPublishingProject: PropTypes.func.isRequired,
    importProject: PropTypes.func.isRequired,
    openProject: PropTypes.func.isRequired,
    createPatch: PropTypes.func.isRequired,
    publishProject: PropTypes.func.isRequired,
    addComment: PropTypes.func.isRequired,
    undoCurrentPatch: PropTypes.func.isRequired,
    redoCurrentPatch: PropTypes.func.isRequired,
    setMode: PropTypes.func.isRequired,
    addError: PropTypes.func.isRequired,
    addConfirmation: PropTypes.func.isRequired,
    addNotification: PropTypes.func.isRequired,
    deleteProcess: PropTypes.func.isRequired,
    showCode: PropTypes.func.isRequired,
    showProjectPreferences: PropTypes.func.isRequired,
    toggleHelp: PropTypes.func.isRequired,
    startDebuggerSession: PropTypes.func.isRequired,
    stopDebuggerSession: PropTypes.func.isRequired,
    toggleDebugger: PropTypes.func.isRequired,
    logDebugger: PropTypes.func.isRequired,
    clearDebugger: PropTypes.func.isRequired,
    showLibSuggester: PropTypes.func.isRequired,
    toggleAccountPane: PropTypes.func.isRequired,
    fetchGrant: PropTypes.func.isRequired,
    togglePanel: PropTypes.func.isRequired,
    runSimulation: PropTypes.func.isRequired,
    runSimulationRequested: PropTypes.func.isRequired,
    abortSimulation: PropTypes.func.isRequired,
    /* eslint-enable react/no-unused-prop-types */
  }),
};

App.actions = {
  selectAll,
  createProject: actions.createProject,
  requestPublishProject: actions.requestPublishProject,
  cancelPublishingProject: actions.cancelPublishingProject,
  importProject: actions.importProject,
  openProject: actions.openProject,
  publishProject: actions.publishProject,
  createPatch: actions.requestCreatePatch,
  addComment: actions.addComment,
  undoCurrentPatch: actions.undoCurrentPatch,
  redoCurrentPatch: actions.redoCurrentPatch,
  setMode: actions.setMode,
  addError: actions.addError,
  addConfirmation: actions.addConfirmation,
  addNotification: actions.addNotification,
  deleteProcess: actions.deleteProcess,
  showCode: actions.showCode,
  showProjectPreferences: actions.showProjectPreferences,
  hideProjectPreferences: actions.hideProjectPreferences,
  updateProjectMeta: actions.updateProjectMeta,
  hideAllPopups: actions.hideAllPopups,
  toggleHelp: actions.toggleHelp,
  startDebuggerSession: actions.startDebuggerSession,
  startSerialSession: actions.startSerialSession,
  stopDebuggerSession: actions.stopDebuggerSession,
  toggleDebugger: actions.toggleDebugger,
  showSuggester: actions.showSuggester,
  logDebugger: actions.addMessagesToDebuggerLog,
  clearDebugger: actions.clearDebuggerLog,
  cutEntities: actions.cutEntities,
  copyEntities: actions.copyEntities,
  pasteEntities: actions.pasteEntities,
  setCurrentPatchOffsetToOrigin: actions.setCurrentPatchOffsetToOrigin,
  setCurrentPatchOffsetToCenter: actions.setCurrentPatchOffsetToCenter,
  showLibSuggester: actions.showLibSuggester,
  toggleAccountPane: actions.toggleAccountPane,
  fetchGrant: actions.fetchGrant,
  togglePanel: actions.togglePanel,
  splitLinksToBuses: actions.splitLinksToBuses,
  runSimulation: actions.runSimulation,
  runSimulationRequested: actions.runSimulationRequested,
  abortSimulation: actions.abortSimulation,
};
