/* eslint-disable radix */
import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import VM from 'clipcc-vm';
import AudioEngine from 'scratch-audio';

import {updateSetting, getSetting} from '../reducers/settings';

import {setProjectUnchanged} from '../reducers/project-changed';
import {
    LoadingStates,
    getIsLoadingWithId,
    onLoadedProject,
    projectError
} from '../reducers/project-state';

/*
 * Higher Order Component to manage events emitted by the VM
 * @param {React.Component} WrappedComponent component to manage VM events for
 * @returns {React.Component} connected component with vm events bound to redux
 */
const vmManagerHOC = function (WrappedComponent) {
    class VMManager extends React.Component {
        constructor (props) {
            super(props);
            bindAll(this, [
                'loadProject'
            ]);
        }
        componentDidMount () {
            if (!this.props.vm.initialized) {
                this.audioEngine = new AudioEngine();
                this.props.vm.attachAudioEngine(this.audioEngine);
                this.props.vm.setCompatibilityMode(true);
                
                //初始化设置
                try {
                    this.props.vm.runtime.setFramerate(this.props.fps);
                    this.props.vm.setCompressionLevel(this.props.compression);
                    this.props.vm.setDeserializeOption(this.props.compatibility);
                } catch (e) {
                    console.log('Failed to initialize settings:', e);
                }
                this.props.vm.initialized = true;
                this.props.vm.setLocale(this.props.locale, this.props.messages);
            }
            if (!this.props.isPlayerOnly && !this.props.isStarted) {
                this.props.vm.start();
            }
        }
        componentDidUpdate (prevProps) {
            // if project is in loading state, AND fonts are loaded,
            // and they weren't both that way until now... load project!
            if (this.props.isLoadingWithId && this.props.fontsLoaded &&
                (!prevProps.isLoadingWithId || !prevProps.fontsLoaded)) {
                this.loadProject();
            }
            // Start the VM if entering editor mode with an unstarted vm
            if (!this.props.isPlayerOnly && !this.props.isStarted) {
                this.props.vm.start();
            }
        }
        loadProject () {
            return this.props.vm.loadProject(this.props.projectData)
                .then(() => {
                    this.props.onLoadedProject(this.props.loadingState, this.props.canSave);
                    // Wrap in a setTimeout because skin loading in
                    // the renderer can be async.
                    setTimeout(() => this.props.onSetProjectUnchanged());

                    // If the vm is not running, call draw on the renderer manually
                    // This draws the state of the loaded project with no blocks running
                    // which closely matches the 2.0 behavior, except for monitors–
                    // 2.0 runs monitors and shows updates (e.g. timer monitor)
                    // before the VM starts running other hat blocks.
                    if (!this.props.isStarted) {
                        // Wrap in a setTimeout because skin loading in
                        // the renderer can be async.
                        setTimeout(() => this.props.vm.renderer.draw());
                    }
                })
                .catch(e => {
                    this.props.onError(e);
                });
        }
        render () {
            const {
                /* eslint-disable no-unused-vars */
                fontsLoaded,
                loadingState,
                locale,
                messages,
                isStarted,
                onError: onErrorProp,
                onLoadedProject: onLoadedProjectProp,
                onSetProjectUnchanged,
                projectData,
                /* eslint-enable no-unused-vars */
                isLoadingWithId: isLoadingWithIdProp,
                vm,
                ...componentProps
            } = this.props;
            return (
                <WrappedComponent
                    isLoading={isLoadingWithIdProp}
                    vm={vm}
                    {...componentProps}
                />
            );
        }
    }

    VMManager.propTypes = {
        canSave: PropTypes.bool,
        cloudHost: PropTypes.string,
        fontsLoaded: PropTypes.bool,
        isLoadingWithId: PropTypes.bool,
        isPlayerOnly: PropTypes.bool,
        isStarted: PropTypes.bool,
        loadingState: PropTypes.oneOf(LoadingStates),
        locale: PropTypes.string,
        messages: PropTypes.objectOf(PropTypes.string),
        onError: PropTypes.func,
        onLoadedProject: PropTypes.func,
        onSetProjectUnchanged: PropTypes.func,
        projectData: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
        projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        username: PropTypes.string,
        fps: PropTypes.number,
        compression: PropTypes.number,
        compatibility: PropTypes.string,
        vm: PropTypes.instanceOf(VM).isRequired
    };

    const mapStateToProps = state => {
        const loadingState = state.scratchGui.projectState.loadingState;
        return {
            fontsLoaded: state.scratchGui.fontsLoaded,
            isLoadingWithId: getIsLoadingWithId(loadingState),
            locale: state.locales.locale,
            messages: state.locales.messages,
            projectData: state.scratchGui.projectState.projectData,
            projectId: state.scratchGui.projectState.projectId,
            loadingState: loadingState,
            isPlayerOnly: state.scratchGui.mode.isPlayerOnly,
            isStarted: state.scratchGui.vmStatus.started,
            fps: parseInt(getSetting(state, 'fps')),
            compression: parseInt(getSetting(state, 'compression')),
            compatibility: getSetting(state, 'compatibility')
        };
    };

    const mapDispatchToProps = dispatch => ({
        onError: error => dispatch(projectError(error)),
        onLoadedProject: (loadingState, canSave) =>
            dispatch(onLoadedProject(loadingState, canSave, true)),
        onSetProjectUnchanged: () => dispatch(setProjectUnchanged())
    });

    // Allow incoming props to override redux-provided props. Used to mock in tests.
    const mergeProps = (stateProps, dispatchProps, ownProps) => Object.assign(
        {}, stateProps, dispatchProps, ownProps
    );

    return connect(
        mapStateToProps,
        mapDispatchToProps,
        mergeProps
    )(VMManager);
};

export default vmManagerHOC;
