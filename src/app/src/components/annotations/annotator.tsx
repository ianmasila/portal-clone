/* eslint-disable react/sort-comp */
/* eslint-disable no-return-assign */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-prototype-builtins */
import * as L from "leaflet";
import "leaflet-draw";
import React, { Component } from "react";
import {
  Card,
  HotkeysTarget,
  Hotkey,
  Hotkeys,
  Button,
  ProgressBar,
  Toaster,
  IToastProps,
  Icon,
  Intent,
} from "@blueprintjs/core";

import makeEta from "simple-eta";

import createBoundingBox, {
  GenerateAssetAnnotations,
  GetAnnotationIntersection,
  AttachAnnotationHandlers,
  AttachAnnotationOptions,
  GetAnnotationColour,
  findFeatureGroupForLayer,
} from "@portal/components/annotations/utils/annotation";

import {
  AnnotationCluster,
  AnnotationLayer,
  PolylineObjectType,
  UserResponse,
} from "@portal/components/annotations/types";

import {
  AssetAPIObject,
  APIGetImageInference,
  APIGetImageData,
  APIGetAsset,
  APIGetVideoInference,
  APIGetModelTags,
  APIGetCacheList,
  APIKillVideoInference,
  APIUpdateAsset,
  APIGetPredictionProgress,
} from "@portal/api/annotation";

import { invert, cloneDeep, isEmpty, throttle } from "lodash";

import { CreateGenericToast } from "@portal/utils/ui/toasts";
import AnnotatorInstanceSingleton from "./utils/annotator.singleton";
import AnnotationMenu from "./menu";
import ImageBar from "./imagebar";
import SettingsModal from "./settingsmodal";
import FileModal from "./filemodal";
import AnnotatorSettings from "./utils/annotatorsettings";
import FormatTimerSeconds from "./utils/timer";
import { RegisteredModel } from "./model";

import AnnotationOptionsMenu from "./annotationoptionsmenu";
import { AlertContent, PrimitiveShapeOptions } from "@portal/constants/annotation";
import { AnnotationAction } from "@portal/components/annotations/enums";
import { NumberGenerator } from "@portal/utils/generators";
import { generateID } from "@portal/utils/index";
import CardNotification from "@portal/components/ui/cardnotification";

type Point = [number, number];
type MapType = L.DrawMap;
type VideoFrameMetadata = {
  presentationTime: DOMHighResTimeStamp;
  expectedDisplayTime: DOMHighResTimeStamp;
  width: number;
  height: number;
  mediaTime: number;
  presentedFrames: number;
  processingDuration: number;

  captureTime: DOMHighResTimeStamp;
  receiveTime: DOMHighResTimeStamp;
  rtpTimestamp: number;
};

/**
 * Enumeration for Existing User Selected Edit Mode
 */
type EditState = "None" | "Open Folder" | "Re-Analyse" | "Bulk Analysis";

function Coordinate(x: number, y: number): Point {
  /* Coordinate Space Resolver */

  return [x, y];
}

type UIState = null | "Predicting";

interface AnnotatorProps {
  project: string;
  user: any;
  useDarkTheme: boolean;
  loadedModel: RegisteredModel | undefined;
  isConnected: boolean;
}

interface AnnotatorState {
  /* Image List for Storing Project Files */
  assetList: Array<AssetAPIObject>;
  /* List of files whose predictions are cached  */
  cacheList: Array<string>;
  /* Tags for Project */
  tagInfo: {
    modelHash: string | undefined;
    tags: { [tag: string]: number };
  };
  /* Changes Made Flag - For Firing Save Button Availability */
  changesMade: boolean;
  /* Current User Editing Mode */
  userEditState: EditState;
  /* File Management Mode */
  fileManagementOpen: boolean;
  /* Tag Management Mode */
  advancedSettingsOpen: boolean;
  /* Image List Collapse Mode */
  imageListCollapsed: boolean;
  /* Hide annotated images in imagebar */
  annotatedAssetsHidden: boolean;
  /* Kill video prediction state */
  killVideoPrediction: boolean;
  /* Sync all folders state */
  isSyncing: boolean;
  /* Set of IDs of hidden annotations */
  hiddenAnnotations: Set<string>;
  /* Is Annotator Predicting? */
  uiState: UIState;
  /* Total number of items and those predicted */
  predictTotal: number;
  predictDone: number;
  multiplier: number;
  /* Confidence */
  confidence: number;
  /* Can't be polyline object type due to confidence attribute */
  currentAssetAnnotations: any;
  /* Filter state to filter out tag labels */
  filterArr: Array<string>;
  /* Boolean to Always Show Label */
  alwaysShowLabel: boolean;
  /* Choose whether to show or hide selected labels */
  showSelected: boolean;
  /* Metadata related to inference */
  inferenceOptions: {
    /* Intersection over Union */
    iou: number;
    cacheResults: boolean;
    bulkAnalysisStatus: string;
    video: {
      /* Frame interval to produce predictions for video */
      frameInterval: number;
    };
  };
  /* Utility to toggle existing annotations */
  annotationOptions: {
    isOutlined: true;
    opacity: number;
  };
  /* Annotation Options Menu Mode */
  annotationOptionsMenuOpen: boolean;
  /* Cursor click position prompting annotation options menu */
  annotationOptionsMenuPosition: {
    x: number;
    y: number;
  } | null;
  annotationOptionsMenuSelection: {
    intersect: boolean;
    selectedAnnotation: AnnotationLayer | null;
    otherAnnotation: AnnotationLayer | null;
  };
  /* Alert Mode */
  alert: {
    isOpen: boolean;
    intent: Intent;
    icon: any;
    content: string;
  },
  callout: {
    show: boolean;
    intent: Intent;
    icon: any;
    content: React.ReactNode;
    center: {
      x: number,
      y: number,
    } | undefined
    onClose: () => void;
  }
  currAnnotationPlaybackId: number,
  /* Currently selected annotation */
  selectedAnnotation: AnnotationLayer | null,
  /* Currently selected annotations clustered up into a unit */
  selectedAnnotationCluster: AnnotationCluster | null;
  /* Grouped annotations: //TODO: USE FEATURE GROUP */
  groupedAnnotations: AnnotationCluster[];
  selectedGroupedAnnotations: AnnotationCluster | null;
}

/* Disable Leaflet.Draw's tooltip suggestions when drawing */
L.drawLocal.draw.handlers.rectangle.tooltip = {
  start: "",
};
L.drawLocal.draw.handlers.simpleshape.tooltip = {
  end: ""
};
L.drawLocal.draw.handlers.polygon.tooltip = {
  start: "",
  cont: "",
  end: "",
};

/**
 * This Annotator class is a super class of the annotator controls, image select
 * as well as the leaflet map for annotation drawing.
 */
@HotkeysTarget
export default class Annotator extends Component<
  AnnotatorProps,
  AnnotatorState
> {
  /* Class Variables */
  public map!: MapType;
  private imageOverlay!: L.ImageOverlay;
  private videoOverlay!: L.VideoOverlay;
  private annotationGroup!: L.FeatureGroup;
  private drawnFeatures: L.FeatureGroup;
  public drawControl: L.Control.Draw;

  /* Annotator ref */
  private annotatorRef: React.RefObject<Annotator>;

  /* Project Properties */
  private project: string;

  /* Component Reference */
  private imagebarRef: any;

  /* Annotation Operations Variables */
  public currentAsset: AssetAPIObject;
  /**
   * Current Tag is read on SetAnnotationTag. this is an unwanted side-effect but
   * Is used to overcome the unused-vars. This is still an important state though
   * so it is being kept here.
   */
  private currentTag: number;
  private menubarRef: React.RefObject<AnnotationMenu>;
  private menubarElement: HTMLElement | undefined;
  // private selectedAnnotation: AnnotationLayer | null;

  /* State for first call on video inference toaster */
  private isFirstCallPerformed: boolean;

  /* States for Toaster */
  private toaster: Toaster;
  private progressToastInterval?: number;
  private refHandlers = {
    toaster: (ref: Toaster) => (this.toaster = ref),
  };

  /* Reference to background Image or Video */
  backgroundImg: HTMLElement | null;
  
  /* Annotation options menu */
  private annotationOptionsMenuRef: React.RefObject<HTMLDivElement>;
  private annotationCallbacks: Record<any, any>;

  /* Mouse activity */
  public isClicked: boolean;
  public startPoint: Point | null;
  public endPoint: Point | null;
  public annotationAction: AnnotationAction;

  /* Keyboard activity */
  public hotkeyToGroup: string;

  /* Iterator whose next function gives the next tag id, simply incremented */
  public tagIdGenerator: NumberGenerator;

  constructor(props: AnnotatorProps) {
    super(props);

    this.state = {
      currentAssetAnnotations: [],
      userEditState: "None",
      changesMade: false,
      assetList: [],
      cacheList: [],
      tagInfo: {
        modelHash: undefined,
        tags: {},
      },
      fileManagementOpen: false,
      advancedSettingsOpen: false,
      imageListCollapsed: false,
      annotatedAssetsHidden: false,
      killVideoPrediction: false,
      isSyncing: false,
      hiddenAnnotations: new Set<string>(),
      uiState: null,
      predictTotal: 0,
      predictDone: 0,
      multiplier: 1,
      confidence: 0.5,
      annotationOptions: {
        isOutlined: true,
        opacity: 0.45,
      },
      annotationOptionsMenuOpen: false,
      annotationOptionsMenuPosition: null,
      annotationOptionsMenuSelection: {
        intersect: false,
        selectedAnnotation: null,
        otherAnnotation: null,
      },
      filterArr: [],
      alwaysShowLabel: false,
      showSelected: true,
      inferenceOptions: {
        bulkAnalysisStatus: "both",
        cacheResults: false,
        iou: 0.8,
        video: {
          frameInterval: 1,
        },
      },
      alert: {
        isOpen: false,
        intent: Intent.NONE,
        icon: null,
        content: "",
      },
      callout: {
        show: false,
        intent: Intent.NONE,
        icon: null,
        content: null,
        center: undefined,
        onClose: this.resetCallout,
      },
      currAnnotationPlaybackId: 0,
      selectedAnnotation: null,
      selectedAnnotationCluster: null,
      groupedAnnotations: [],
      selectedGroupedAnnotations: null,
    };

    this.hotkeyToGroup = 'Shift';
    this.tagIdGenerator = new NumberGenerator();

    this.toaster = new Toaster({}, {});
    this.progressToastInterval = 600;

    this.currentTag = 0;
    this.project = this.props.project;
    this.menubarRef = React.createRef();
    this.annotationOptionsMenuRef = React.createRef();
    this.menubarElement = undefined;

    this.isFirstCallPerformed = false;

    /* Placeholder Value for Initialization */
    this.currentAsset = {} as AssetAPIObject;
    // this.selectedAnnotation = this.state.selectedAnnotation;

    this.annotationGroup = new L.FeatureGroup();
    this.drawnFeatures = new L.FeatureGroup();
    this.drawControl = 
      new L.Control.Draw({
        edit: {
          featureGroup: this.annotationGroup,
          remove: true,
        },
      });

    /* Image Bar Reference to Track Which Image is Selected */
    this.imagebarRef = React.createRef();
    this.backgroundImg = null;

    this.annotatorRef = React.createRef();
    /* Mouse variables */
    this.isClicked = false;
    this.startPoint = null;
    this.endPoint = null;
    this.annotationAction = AnnotationAction.UNDETERMINED;

    this.annotationCallbacks = {};

    this.selectAsset = this.selectAsset.bind(this);
    this.showToaster = this.showToaster.bind(this);
    this.renderProgress = this.renderProgress.bind(this);
    this.renderAlert = this.renderAlert.bind(this);
    this.singleAnalysis = this.singleAnalysis.bind(this);
    this.getInference = this.getInference.bind(this);
    this.bulkAnalysis = this.bulkAnalysis.bind(this);
    this.renderAnnotations = this.renderAnnotations.bind(this);
    this.updateAnnotation = this.updateAnnotation.bind(this);

    this.resetControls = this.resetControls.bind(this);

    this.refreshProject = this.refreshProject.bind(this);
    this.setAnnotationTag = this.setAnnotationTag.bind(this);
    this.switchAnnotation = this.switchAnnotation.bind(this);
    this.handleFileManagementOpen = this.handleFileManagementOpen.bind(this);
    this.handleFileManagementClose = this.handleFileManagementClose.bind(this);
    this.handleAdvancedSettingsOpen = this.handleAdvancedSettingsOpen.bind(this);
    this.handleAdvancedSettingsClose = this.handleAdvancedSettingsClose.bind(this);
    this.handleAnnotationOptionsMenuOpen = this.handleAnnotationOptionsMenuOpen.bind(this);
    this.handleAnnotationOptionsMenuClose = this.handleAnnotationOptionsMenuClose.bind(this);
    this.handleAnnotationOptionsMenuSelection = this.handleAnnotationOptionsMenuSelection.bind(this);
    this.handleAlertClose = this.handleAlertClose.bind(this);
    this.handleAlertOpen = this.handleAlertOpen.bind(this);
    this.handleCalloutClose = this.handleCalloutClose.bind(this);
    this.handleCalloutOpen = this.handleCalloutOpen.bind(this);
    this.handleCalloutClickOutside = this.handleCalloutClickOutside.bind(this);
    this.updateCallout = this.updateCallout.bind(this);
    this.resetCallout = this.resetCallout.bind(this);
    this.resetSelectedAnnotationCluster = this.resetSelectedAnnotationCluster.bind(this); 
    this.handleAnnotationOptionsMenuReset = this.handleAnnotationOptionsMenuReset.bind(this);
    this.handlePlayPauseVideoOverlay = this.handlePlayPauseVideoOverlay.bind(this);
    this.updateImage = this.updateImage.bind(this);

    this.setAnnotationVisibility = this.setAnnotationVisibility.bind(this);
    this.setAllAnnotationVisibility = this.setAllAnnotationVisibility.bind(this);
    this.filterAnnotationVisibility = this.filterAnnotationVisibility.bind(this);
    this.bindAnnotationTooltip = this.bindAnnotationTooltip.bind(this);
    this.setAnnotationOptions = this.setAnnotationOptions.bind(this);
    this.toggleShowSelected = this.toggleShowSelected.bind(this);
    this.setAnnotatedAssetsHidden = this.setAnnotatedAssetsHidden.bind(this);
    this.intersectAnnotations = this.intersectAnnotations.bind(this);

    this.handleKeyDownGroup = this.handleKeyDownGroup.bind(this);
    this.handleKeyUpGroup = this.handleKeyUpGroup.bind(this);
    this.handleKeyUpShift = this.handleKeyUpShift.bind(this);

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseOut = this.handleMouseOut.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);

    this.handleCreated = this.handleCreated.bind(this);
    this.handleEditResize = throttle(this.handleEditResize, 1000).bind(this);
    this.handleEditVertex = this.handleEditVertex.bind(this);
    this.handleEditMove = throttle(this.handleEditMove, 1000).bind(this);

    this.getSelectedAnnotation = this.getSelectedAnnotation.bind(this);
    this.updateSelectedAnnotationCluster = this.updateSelectedAnnotationCluster.bind(this);
    this.handleGroupAnnotations = this.handleGroupAnnotations.bind(this);
    this.setSelectedAnnotation = this.setSelectedAnnotation.bind(this);
    this.setSelectedAnnotationGroup = this.setSelectedAnnotationGroup.bind(this);
  }

  async componentDidMount(): Promise<void> {
    this.menubarElement = document.getElementById("image-bar") as HTMLElement;

    /* Attach Listeners for Translating Vertical to Horizontal Scroll */
    this.menubarElement.addEventListener(
      "onwheel" in document ? "wheel" : "mousewheel",
      this.handleVerticalScrolling
    );

    /* Implicit rR Loading for Leaflet */
    this.map = L.map("annotation-map", {
      scrollWheelZoom: true,
      zoomAnimation: false,
      zoomDelta: 0,
      zoomSnap: 0,
      minZoom: -3,
      maxZoom: 3,
      crs: L.CRS.Simple,
      attributionControl: false,
      zoomControl: false,
      doubleClickZoom: false,
    }).setView(Coordinate(5000, 5000), 0);

    this.annotationGroup.addTo(this.map);
    this.drawControl.addTo(this.map);

    // Add event listener for when a new shape is created
    this.map.on(L.Draw.Event.CREATED, this.handleCreated);
    this.map.on(L.Draw.Event.EDITRESIZE, this.handleEditResize);
    this.map.on(L.Draw.Event.EDITVERTEX, this.handleEditVertex);
    this.map.on(L.Draw.Event.EDITMOVE, this.handleEditMove);

    this.map.on("mousedown", this.handleMouseDown);
    this.map.on("mouseup", this.handleMouseUp);
    this.map.on("mousemove", this.handleMouseMove);
    this.map.on("mouseout", this.handleMouseOut);
    this.map.on("contextmenu", this.handleContextMenu);

    this.map.on("mouseup", () => {
      if (this.videoOverlay) {
        const videoElement = this.videoOverlay.getElement();
        if (videoElement !== document.activeElement) {
          videoElement?.focus();
        }
      }
    });

    const imageUrl = "";
    const imageBounds = [Coordinate(30000, 0), Coordinate(0, 23000)];
    /* Render First Image */
    this.imageOverlay = L.imageOverlay(imageUrl, imageBounds);
    this.videoOverlay = L.videoOverlay(imageUrl, imageBounds, {
      interactive: true,
    });

    /**
     * Setup Singleton Instance to Annotator and Map
     */
    // eslint-disable-next-line no-new
    new AnnotatorInstanceSingleton(this.map, this);

    /* Slight delay so that all images can be reliably fetched from the server */
    setTimeout(() => this.updateImage(), 200);

    window.addEventListener('keyup', this.handleKeyUpShift);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  componentDidUpdate() {
    /* Obtain Tag Map for loaded Model */
    /* The conditional checks are necessary due to the use of setStates */
    if (
      this.props.loadedModel &&
      this.props.loadedModel.hash !== this.state.tagInfo.modelHash
    ) {
      APIGetModelTags(this.props.loadedModel.hash)
        .then(result => {
          const tagInfo = {
            modelHash: this.props.loadedModel?.hash,
            tags: result.data,
          };
          this.setState({
            tagInfo,
            advancedSettingsOpen: false,
          });
          if (Object.keys(this.state.tagInfo.tags).length > 0) {
            this.currentTag = Object.values(this.state.tagInfo.tags)[0];
          }          

          (this.annotationGroup as any).tags = this.state.tagInfo.tags;
        })
        .catch(error => {
          let message = "Failed to obtain loaded model tags.";
          if (error.response) {
            message = `${error.response.data.message}`;
          }

          CreateGenericToast(message, Intent.DANGER, 3000);
        });
      this.updateImage();
    }

    if (!this.props.loadedModel && this.state.tagInfo.modelHash !== undefined) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({
        tagInfo: {
          modelHash: undefined,
          tags: {},
        },
      });
      (this.annotationGroup as any).tags = this.state.tagInfo.tags;
    }

    /* Results of annotation menu option, e.g. show intersection polygon */
    const annotationOptionsSelectedAnnotation = this.state.annotationOptionsMenuSelection.selectedAnnotation;
    const annotationOptionsOtherAnnotation = this.state.annotationOptionsMenuSelection.otherAnnotation;
    const annotationOptionsIsIntersect = this.state.annotationOptionsMenuSelection.intersect;

    if (annotationOptionsSelectedAnnotation && annotationOptionsOtherAnnotation) {
      if (annotationOptionsIsIntersect) {
        this.intersectAnnotations(annotationOptionsSelectedAnnotation, annotationOptionsOtherAnnotation);
      }
    
      // Reset annotation options menu selection
      this.handleAnnotationOptionsMenuReset();
    }
  }

  componentWillUnmount(): void {
    /* Check if Menubar Targetted */
    if (this.menubarElement !== undefined) {
      this.menubarElement.removeEventListener(
        "onwheel" in document ? "wheel" : "mousewheel",
        this.handleVerticalScrolling
      );
    }

    this.map.off("mousedown", this.handleMouseDown);
    this.map.off("mouseup", this.handleMouseUp);
    this.map.off("mousemove", this.handleMouseMove);
    this.map.off("mouseout", this.handleMouseUp);
    this.map.off("contextmenu", this.handleContextMenu);

    this.map.off(L.Draw.Event.CREATED, this.handleCreated);
    this.map.off(L.Draw.Event.EDITRESIZE, this.handleEditResize);
    this.map.off(L.Draw.Event.EDITVERTEX, this.handleEditVertex);
    this.map.off(L.Draw.Event.EDITMOVE, this.handleEditMove);

    window.removeEventListener('keyup', this.handleKeyUpShift);
  }

  private handlePlayPauseVideoOverlay() {
    const videoElement = this.videoOverlay?.getElement();

    if (videoElement) {
      if (videoElement.onplaying) {
        if (videoElement.paused) {
          videoElement.play();
        } else {
          videoElement.pause();
        }
      }
    }
  }

  private handleAdvancedSettingsClose() {
    this.setState({ advancedSettingsOpen: false });
  }
  private handleAdvancedSettingsOpen() {
    this.setState({ advancedSettingsOpen: true });
  }

  private handleAnnotationOptionsMenuClose() {
    this.setState({ annotationOptionsMenuOpen: false });
  }
  private handleAnnotationOptionsMenuOpen() {
    this.setState({ annotationOptionsMenuOpen: true });
  }

  private handleCalloutClose() {
    this.setState(prevState => {
      return { callout: {...prevState.callout, show: false } }
    });
  }
  private handleCalloutOpen() {
    this.setState(prevState => {
      return { callout: {...prevState.callout, show: true } }
    });
  }

  private handleCalloutClickOutside(e: L.LeafletMouseEvent) {
    // const selectedAnnotation = this.getSelectedAnnotation(e);
    // if (selectedAnnotation) {

    // }
  }

  private updateCallout = (options: Partial<AnnotatorState['callout']>) => {
    this.setState(prevState => {
      return {
        callout: {
          ...prevState.callout, 
          ...options,
        }
      }
    })
  }

  private resetCallout() {
    this.setState({ 
      callout: {
        show: false,
        intent: Intent.NONE,
        icon: null,
        content: "",
        center: undefined,
        onClose: this.resetCallout
      }
    });
  }

  private handleAnnotationOptionsMenuReset() {
    this.setState({ 
      annotationOptionsMenuOpen: false,
      annotationOptionsMenuPosition: null,
      annotationOptionsMenuSelection: {
        intersect: false,
        selectedAnnotation: null,
        otherAnnotation: null,
      }
    });
  }

  private handleAlertClose() {
    this.setState({ 
      alert: {
        isOpen: false,
        intent: Intent.NONE,
        icon: null,
        content: "",
      } 
    });
  }
  private handleAlertOpen(content: string, icon?: any, intent: Intent = Intent.PRIMARY) {
    this.setState({ 
      alert: {
        isOpen: true,
        intent,
        icon,
        content,
      } 
    });
  }

  private handleFileManagementClose() {
    this.setState({ fileManagementOpen: false });
  }
  private handleFileManagementOpen() {
    this.setState({ fileManagementOpen: true });
  }

  /* Handler for Converting Vertical Scroll to Horizontal Scroll */
  private handleVerticalScrolling = (e: any) => {
    const dist = e.deltaY * 1.5;
    /* Check if Targeted */
    if (this.menubarElement !== undefined)
      this.menubarElement.scrollLeft += dist;
  };

  /**
   * Setting of User State
   */
  private setUserState(state: EditState) {
    if (this.state.userEditState === state) return;

    if (state === "None") {
      this.setState({ userEditState: state });
      return;
    }

    this.resetControls();
    this.setState({ userEditState: state });
  }

  public setAnnotationTag(id: number): number {
    this.currentTag = id;
    return this.currentTag;
  }

  /**
   * Updates the annotationOptions, handling both boolean
   * and number case
   * @param {boolean | number } newOption - updatedOptions
   */
  private setAnnotationOptions(newOption: boolean | number): void {
    this.setState(
      prevState => {
        const config = prevState.annotationOptions;
        switch (typeof newOption) {
          case "boolean":
            config.isOutlined = newOption
              ? true
              : (!prevState.annotationOptions.isOutlined as any);
            break;
          case "number":
            config.opacity = newOption;
            break;
          default:
            break;
        }
        return { annotationOptions: config };
      },
      () => this.filterAnnotationVisibility()
    );
  }

  /**
   * Show or hide a list of annotations.
   * @param visible - set true to show annotations, false to hide annotations
   * @param annotationList -  list of target annotations
   */
  public setAnnotationVisibility(
    visible: boolean,
    ...annotationList: any[]
  ): void {
    this.setState(
      prevState => {
        const hiddenAnnotations = new Set<string>(prevState.hiddenAnnotations);    
        annotationList.forEach(annotation => {
          if (visible) {
            hiddenAnnotations.delete(annotation.options.annotationID);
          } else {
            hiddenAnnotations.add(annotation.options.annotationID);
          }
        });

        // Reduce function to find and collect unique annotation groups in a Set
        const annotationGroups = annotationList.reduce((groups, annotation) => {
          const group = this.state.groupedAnnotations.find(cluster => 
            cluster.annotations.some(item => item === annotation)
          );
          if (group) {
            groups.add(group); // Add the group to the Set to ensure uniqueness
          }
          return groups;
        }, new Set());

        // Iterate over the unique annotation groups
        annotationGroups.forEach((group: any) => {
          group.bbox?.setStyle({ opacity: 0 });
          if (visible) {
            group?.annotations?.forEach((annotation: any) => hiddenAnnotations.delete(annotation.options.annotationID));
          } else {
            group?.annotations?.forEach((annotation: any) => hiddenAnnotations.add(annotation.options.annotationID));
          }
        });

        // TODO: USE FEATURE GROUP: SEARCH OVER NESTED GROUPS, NOT SUPER GROUP
        // const annotationGroups = annotationList.reduce((groups, annotation) => {
        //   const group = findFeatureGroupForLayer(annotation, this.annotationGroup);
        //   if (group) {
        //     groups.push(group);
        //   }
        //   return groups;
        // }, []);    

        // annotationGroups.forEach(group => {
        //   if (visible) {
        //     group.eachLayer(annotation => hiddenAnnotations.delete(annotation.options.annotationID));
        //   } else {
        //     group.eachLayer(annotation => hiddenAnnotations.add(annotation.options.annotationID));
        //   }
        // })

        return { hiddenAnnotations };
      },
      () => this.filterAnnotationVisibility()
    );
  }

  /**
   * Show or hide all annotations in annotationGroup.
   * @param visible - set true to show annotations, false to hide annotations
   */
  public setAllAnnotationVisibility(visible: boolean): void {
    /* Hide all annotations */
    if (visible) {
      this.map.addLayer(this.annotationGroup);
      /* Clear hidden annotations */
      this.setState({ hiddenAnnotations: new Set() });
    } else {
      this.map.removeLayer(this.annotationGroup);
      /* Set of all annotation IDs in annotationGroup */
      this.setState({
        hiddenAnnotations: new Set<string>(
          Object.values((this.annotationGroup as any)._layers).map(
            (annotation: any) => annotation.options.annotationID as string
          )
        ),
      });
    }
  }

  /**
   * @param annotation Annotation layer
   * @param options Options object to set to annotation
   */
  public updateAnnotation(annotation: AnnotationLayer | undefined | null, options: { [key: string]: any } = {}): void {
    if (!annotation) {
      return
    }
    const currentAssetAnnotationsClone = (this.state.currentAssetAnnotations as PolylineObjectType[]).slice();
    const newAssetAnnotations = currentAssetAnnotationsClone.filter(
      assetAnnotation => assetAnnotation !== annotation as L.Layer as PolylineObjectType);

    Object.entries(options).forEach(([key, value]) => {
      (annotation.options as any)[key] = value;
    });

    // If annotation tag is updated, update annotation colour too
    if (options.annotationTag) {
      const annotationColor = GetAnnotationColour(undefined, options.annotationTag);
      (annotation.options as any).color = annotationColor;
      (annotation.options as any).fillColor = annotationColor;
    }

    (annotation.options as any).updatedAt = Date.now();
    // Note: Update canvas' annotations. This is a workaround since `filterAnnotationVisibility` needs quite some refactoring

    newAssetAnnotations.push(annotation as L.Layer as PolylineObjectType);
    this.updateCurrentAssetAnnotations(newAssetAnnotations);
    this.updateMenuBarAnnotations();
    this.bindAnnotationTooltip(annotation);
    this.setSelectedAnnotation(annotation, !!annotation.editing);
  }

  /**
   * Intersect 2 annotations in annotationGroup
   * @param annotation1 - The first annotation to intersect
   * @param annotation2 - The second annotation to intersect
   * @returns {AnnotationLayer} The intersected annotation as a polygon or null if no intersection
   * 
   */
  public intersectAnnotations(annotation1: AnnotationLayer, annotation2: AnnotationLayer): AnnotationLayer {
    const poly1 = annotation1 as L.Layer as PolylineObjectType;
    const poly2 = annotation2 as L.Layer as PolylineObjectType;
    // TODO: ATTACH OPTIONS PROPERLY TO INTERSECTION POLYGON
    const intersection = GetAnnotationIntersection(poly1, poly2);
    if (intersection) {
      const intersectionWithListeners = AttachAnnotationHandlers(
        intersection,
        this.map, 
        this.annotationGroup, 
        this.project, 
        (intersection.options as any).annotationID, 
        this.annotationCallbacks,
      );
      const options = intersectionWithListeners.options as any;
      this.addNewTag(options.annotationID, options.annotationTag);
      // Add intersection to map's annotation group
      this.annotationGroup.addLayer(intersectionWithListeners);
      // Remove the original annotations from the map's annotation group
      this.annotationGroup.removeLayer(annotation1);
      this.annotationGroup.removeLayer(annotation2);

      // Note: Update canvas' annotations. This is a workaround since `filterAnnotationVisibility` needs quite some refactoring
      const newAssetAnnotations = (this.state.currentAssetAnnotations as PolylineObjectType[]).slice().filter(annotation => 
        annotation !== poly1 && annotation !== poly2);
      newAssetAnnotations.push(intersectionWithListeners);

      this.updateCurrentAssetAnnotations(newAssetAnnotations);
      this.updateMenuBarAnnotations();
      this.bindAnnotationTooltip(intersectionWithListeners, options.annotationID);
    } else {
      this.toaster.show(this.renderAlert(AlertContent.INTERSECT.EMPTY_RESULT, undefined, Intent.WARNING, 2000));
    }

    const result = intersection as L.Layer as AnnotationLayer;
    return result;
  }

  /**
   * Set image bar to either show thumbnails for all assets,
   * or only assets that are unannotated
   * @param flag - Whether to show only unannotated thumbnails
   */
  public setAnnotatedAssetsHidden(flag: boolean): void {
    this.setState({ annotatedAssetsHidden: flag });
  }

  private async killVideoPrediction() {
    this.setState({ killVideoPrediction: true, uiState: null });
    if (this.currentAsset.type === "video") {
      await APIKillVideoInference().catch(error => {
        let message = "Failed to kill video prediction.";
        if (error.response) {
          message = `${error.response.data.message}`;
        }
        CreateGenericToast(message, Intent.DANGER, 3000);
      });
    }
  }

  private async bulkAnalysis() {
    /* Blocker to account for case where there is no model or image to perform prediction */
    if (isEmpty(this.state.assetList) && !this.props.loadedModel) {
      CreateGenericToast(
        "There are no models and images loaded",
        Intent.WARNING,
        3000
      );
      return;
    }
    if (!this.props.loadedModel) {
      CreateGenericToast("There is no model loaded", Intent.WARNING, 3000);
      return;
    }
    if (isEmpty(this.state.assetList)) {
      CreateGenericToast("There is no image loaded", Intent.WARNING, 3000);
      return;
    }

    let numberToBulkAnalysis: number;
    let bulkList: any[];
    switch (this.state.inferenceOptions.bulkAnalysisStatus) {
      case "image": {
        bulkList = this.state.assetList.filter(asset => asset.type === "image");
        numberToBulkAnalysis = bulkList.length;
        break;
      }
      case "video": {
        bulkList = this.state.assetList.filter(asset => asset.type === "video");
        numberToBulkAnalysis = bulkList.length;
        break;
      }
      case "both": {
        bulkList = this.state.assetList;
        numberToBulkAnalysis = this.state.assetList.length;
        break;
      }
      default:
        bulkList = this.state.assetList;
        numberToBulkAnalysis = this.state.assetList.length;
        break;
    }

    this.setState({
      predictTotal: numberToBulkAnalysis,
      predictDone: 0,
      multiplier: 1,
      uiState: "Predicting",
    });

    const key = this.toaster.show(this.renderProgress(0));

    // eslint-disable-next-line no-restricted-syntax
    for (const asset of bulkList) {
      if (this.state.killVideoPrediction) {
        if (asset.type === "image")
          // eslint-disable-next-line no-await-in-loop
          await this.getInference(this.currentAsset, false);
        break;
      }
      this.selectAsset(asset, false);
      // eslint-disable-next-line no-await-in-loop
      await this.getInference(asset, true);
      if (this.state.uiState === "Predicting") {
        this.setState(
          prevState => {
            return { predictDone: prevState.predictDone + 1 };
          },
          () => {
            this.toaster.show(
              this.renderProgress(
                (this.state.predictDone / this.state.predictTotal) * 100
              ),
              key
            );
          }
        );
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise(res => setTimeout(res, 1000));
    }

    await this.updateImage();
    this.setState({
      predictDone: 0,
      predictTotal: 100,
      uiState: null,
      killVideoPrediction: false,
    });
  }

  /**
   * Perform single predictions fore either Video or Image
   */
  private async singleAnalysis(reanalyse = true) {
    /* Blocker to account for case where prediction is still running */
    if (this.state.predictDone !== 0 || this.state.uiState === "Predicting") {
      CreateGenericToast("Inference is already running", Intent.WARNING, 3000);
      return;
    }

    if (isEmpty(this.currentAsset) && !this.props.loadedModel) {
      CreateGenericToast(
        "There is no model and image loaded",
        Intent.WARNING,
        3000
      );
      return;
    }

    if (isEmpty(this.currentAsset)) {
      CreateGenericToast("There is no image loaded", Intent.WARNING, 3000);
      return;
    }

    if (!this.props.loadedModel) {
      CreateGenericToast("There is no model loaded", Intent.WARNING, 3000);
      return;
    }

    this.setState({
      predictTotal: 100,
      predictDone: 0.01,
      multiplier: 1,
      uiState: "Predicting",
    });
    if (reanalyse && this.currentAsset.type === "video") {
      this.handleProgressToast(true);
      this.videoOverlay.getElement()?.pause();
    } else if (reanalyse) this.handleProgressToast();
    await this.getInference(this.currentAsset, reanalyse);
    await this.updateImage();
    if (this.currentAsset.type === "video")
      this.videoOverlay.getElement()?.play();
    this.setState({
      predictDone: 0,
      uiState: null,
      killVideoPrediction: false,
    });
  }

  /**
   * Centralized Handler to Perform predictions on both Video and Images
   */
  private async getInference(
    asset: AssetAPIObject,
    reanalyse = true,
    singleAnalysis = true
  ) {
    /* Blocker to account for case where there is no model to perform prediction */
    if (!this.props.loadedModel) {
      return;
    }

    const loadedModelHash = this.props.loadedModel.hash;
    /* Hidden annotations reset every time this is initialized */
    this.setState({ hiddenAnnotations: new Set<string>() });

    if (
      asset.type === "image" &&
      (this.state.inferenceOptions.bulkAnalysisStatus !== "video" ||
        singleAnalysis)
    ) {
      await APIGetImageInference(
        loadedModelHash,
        asset.localPath,
        reanalyse,
        this.state.inferenceOptions.iou,
        "json"
      )
        .then(response => {
          if (this.currentAsset.url === asset.url && singleAnalysis)
            this.renderAnnotations(response.data);
        })
        .catch(error => {
          let message = "Failed to predict image.";
          if (error.response) {
            message = `${error.response.data.message}`;
          }
          CreateGenericToast(message, Intent.DANGER, 3000);
        });
    }
    if (
      asset.type === "video" &&
      (this.state.inferenceOptions.bulkAnalysisStatus !== "image" ||
        singleAnalysis)
    ) {
      await APIGetVideoInference(
        loadedModelHash,
        asset.localPath,
        reanalyse,
        this.state.inferenceOptions.video.frameInterval,
        this.state.inferenceOptions.iou
      )
        .then(response => {
          if (this.currentAsset.url === asset.url && singleAnalysis) {
            const videoElement = this.videoOverlay.getElement();
            /**
             * Recursive Callback function that
             * @param {DOMHighResTimeStamp} now
             * @param {VideoFrameMetadata} metadata
             */
            const videoFrameCallback = (
              now: DOMHighResTimeStamp,
              metadata: VideoFrameMetadata
            ) => {
              /* Calculating the refresh rate of annotation rendering */
              const secondsInterval =
                this.state.inferenceOptions.video.frameInterval /
                response.data.fps;
              const quotient = Math.floor(metadata.mediaTime / secondsInterval);

              /* Interval to determine the refresh-rate of annotation */
              const key = Math.floor(
                quotient * secondsInterval * 1000
              ).toString();

              if (response.data.frames[key]) {
                this.renderAnnotations(response.data.frames[key]);
              }

              /**
               * Id to track the current handler number so that this handler
               * can be removed when selectAsset is called. more information
               * on https://wicg.github.io/video-rvfc/
               */
              const videoId = (videoElement as any).requestVideoFrameCallback(
                videoFrameCallback
              );
              this.setState({ currAnnotationPlaybackId: videoId });
            };

            if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
              (videoElement as any).requestVideoFrameCallback(
                videoFrameCallback
              );
            }
          }
        })
        .catch(error => {
          let message = "Failed to predict video.";
          let intent: Intent = Intent.DANGER;
          if (error.response) {
            message = `${error.response.data.message}`;
          }
          if (error.response.data.error === "STOPPEDPROCESS")
            intent = Intent.PRIMARY;
          CreateGenericToast(message, intent, 3000);
        });
    }
  }

  /**
   * Atomic function that takes annotations generated from getInference
   * and renders the annotations on the Leaflet Layer
   * @param {any} annotations
   */
  private renderAnnotations = (annotations: any) => {
    const res = {
      metadata: this.currentAsset.metadata,
      url: this.currentAsset.url,
      filename: this.currentAsset.filename,
      assetUrl: this.currentAsset.assetUrl,
      annotations,
      thumbnailUrl: this.currentAsset.thumbnailUrl,
      localPath: this.currentAsset.localPath,
      type: this.currentAsset.type,
      isCached: this.currentAsset.isCached,
    };
    const { polylineObjects: currentAssetAnnotations, lastAnnotationTag, lastAnnotationID } = GenerateAssetAnnotations(
      this.map,
      this.annotationGroup,
      res,
      this.project,
      this.currentAsset.metadata.width,
      this.currentAsset.metadata.height,
      // eslint-disable-next-line react/no-access-state-in-setstate
      this.state.tagInfo.tags,
      this.annotationCallbacks,
    );

    this.tagIdGenerator.setLastId(lastAnnotationTag);

    this.annotationGroup.clearLayers();

    currentAssetAnnotations.forEach(annotation => {
      this.annotationGroup.addLayer(annotation);
    });

    /* Update current asset annotations. Used in visibility functionality */
    this.updateCurrentAssetAnnotations(currentAssetAnnotations);
    /* Update menu bar annotations */
    this.updateMenuBarAnnotations();
    /* Show all annotations */
    this.filterAnnotationVisibility();
  };

  /**
   * Update ImageBar by reseting the cachelist and assetlist
   */
  private updateImage = async () => {
    if (this.props.loadedModel) {
      /**
       * Get list of files that has its prediction cached
       */
      await APIGetCacheList(this.props.loadedModel.hash)
        .then(res => {
          this.setState({ cacheList: res.data });
        })
        .catch(() => {
          /* Empty the cacheList since we can't get the list */
          this.setState({ cacheList: [] });
        });
    }

    /* Get All Existing Registered Folder and Image Assets */
    await APIGetAsset().then(res => {
      /* Generate New Asset List Based on Updated Data */
      const newImageAssets = res.data.map((encodedUri: string) => {
        const decodedUri = decodeURIComponent(encodedUri);
        const seperator = decodedUri.includes("\\") ? "\\" : "/";
        const type = decodedUri.match(/\.(?:mov|mp4|wmv)/i) ? "video" : "image";
        const isCached = this.state.cacheList.includes(encodedUri);
        return {
          url: encodedUri,
          filename: decodedUri.split(seperator).pop(),
          assetUrl: APIGetImageData(encodedUri),
          thumbnailUrl: APIGetImageData(encodedUri),
          localPath: encodedUri,
          type,
          isCached,
        };
      });

      this.setState({ assetList: newImageAssets });
    });
  };

  private setFilterArr = (values: Array<string>) => {
    this.setState({ filterArr: values }, () => {
      this.filterAnnotationVisibility();
    });
  };

  private toggleShowSelected = () => {
    this.setState(
      prevState => {
        return {
          showSelected: !prevState.showSelected,
        };
      },
      () => {
        this.filterAnnotationVisibility();
      }
    );
  };

  private toggleConfidence = (value: number) => {
    /* Set Confidence Value based on Slider moving */
    this.setState({ confidence: value / 100 }, () => {
      this.filterAnnotationVisibility();
    });
  };

  private handleChangeInAdvancedSettings = (value: any, key: string) => {
    this.setState(prevState => {
      const settings = prevState.inferenceOptions;
      if (key === "bulkAnalysisStatus") {
        settings.bulkAnalysisStatus = value;
      }
      if (key === "frameInterval") {
        settings.video.frameInterval = value;
      }
      if (key === "iou") {
        settings.iou = value;
      }
      return { inferenceOptions: settings };
    });
  };

  /**
   * @param e `Polyline; Polygon; Rectangle; Circle; Marker` Layer that was just created. 
   * Triggered when a new vector or marker has been created.
   */
  private handleCreated = (e: any) => {
    const layer = e.layer;
    const options = {
      annotationTag: this.currentTag,
      annotationID: generateID(),
      annotationAssetID: this.currentAsset.assetUrl,
      annotationType: e.layerType,
      annotationProjectID: this.project,
      confidence: this.state.confidence,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const layerWithOptions = AttachAnnotationOptions(layer, options);
    const layerWithListeners = AttachAnnotationHandlers(
      layerWithOptions,
      this.map, 
      this.annotationGroup, 
      this.project, 
      (layerWithOptions.options as any).annotationID, 
      this.annotationCallbacks,
    );

    this.drawnFeatures.addLayer(layerWithListeners);
    this.annotationGroup.addLayer(layerWithListeners);

    // Note: Update canvas' annotations. This is a workaround since `filterAnnotationVisibility` needs quite some refactoring
    const newAssetAnnotations = (this.state.currentAssetAnnotations as PolylineObjectType[]).slice();
    newAssetAnnotations.push(layerWithListeners);
  
    this.updateCurrentAssetAnnotations(newAssetAnnotations);
    this.updateMenuBarAnnotations();
    this.bindAnnotationTooltip(layerWithListeners);
  }

  private highlightAnnotation = (annotation: AnnotationLayer, enable: boolean = true) => {
    if (enable) {
      annotation.options.fillOpacity = 0.7;
      annotation.options.weight = PrimitiveShapeOptions.weight*1.2; 
    } else {
      annotation.options.fillOpacity = PrimitiveShapeOptions.fillOpacity;
      annotation.options.weight = PrimitiveShapeOptions.weight; 
    }

    // Force a redraw of the annotation
    if ((annotation as any).setStyle) {
      (annotation as any).setStyle({
        fillOpacity: annotation.options.fillOpacity,
        weight: annotation.options.weight,
      });
    }
  }

  /**
   * @param e Layer that was just resized.  
   * Triggered as the user resizes a rectangle or circle.
   * This method is called repeatedly as the user resizes the layer so we have throttled it to 1000ms. 
   */
  private handleEditResize = (e: any) => {
    this.annotationAction = AnnotationAction.EDIT;
  };

  /**
   * @param e List of all layers just being edited from the map. 
   * Triggered when a vertex is edited on a polyline or polygon.
   */
  private handleEditVertex = (e: any) => {
    // console.log("🚀 ~ handleEditVertex e:", e);
    this.annotationAction = AnnotationAction.EDIT;
  };

  /**
   * @param e Event with Layer that was just moved. 
   * Triggered as the user moves a rectangle; circle or marker.
   * This method is called repeatedly as the user resizes the layer so we have throttled it to 1000ms. 
   */
  private handleEditMove = (e: any) => {
    // console.log("🚀 ~ handleEditMove e:", e);
    this.annotationAction = AnnotationAction.EDIT;
  };

  /**
   * @param e 
   * Handle keydown event of hotkey for grouping annotations
   */
  private handleKeyDownGroup = (e: KeyboardEvent) => {
    if (this.annotationAction === AnnotationAction.WAITIING) {
      return;
    }
    this.annotationAction = AnnotationAction.GROUP;
    this.setSelectedAnnotation(null);
    this.updateCallout({
      onClose: () => this.handleGroupAnnotations('cancel')
    })
  }

  /**
   * @param e 
   * Handle keyup event of hotkey for grouping annotations
   */
  private handleKeyUpGroup = (e: KeyboardEvent) => {
    if (this.annotationAction === AnnotationAction.GROUP && this.state.callout.show) {
      this.annotationAction = AnnotationAction.WAITIING;
      return;
    } 
  }

  /**
   * @param e {KeyboardEvent} 
   * Hotkeying Shift does not fire Hotkey onKeyUp event hence the need to listen for it with the window
   * @returns 
   */
  private handleKeyUpShift = (e: KeyboardEvent) => {
    if (e.key !== 'Shift') {
      return;
    }
    if (this.hotkeyToGroup === 'Shift' && this.annotationAction === AnnotationAction.GROUP) {
      this.handleKeyUpGroup(e);
    }
  }

  private handleMouseDown = (e: L.LeafletMouseEvent) => {
    // console.log("🚀 ~ handleMouseDown e:", e)
    switch (this.annotationAction) {
      case AnnotationAction.SELECT:
      case AnnotationAction.GROUP:
      case AnnotationAction.WAITIING:
        return;
      case AnnotationAction.UNDETERMINED:
      default:
        this.annotationAction = AnnotationAction.SELECT;
        return;
    }
  }
  
  private handleMouseUp = (e: L.LeafletMouseEvent) => {
    // console.log("🚀 ~ handleMouseUp:", e)
    switch (this.annotationAction) {
      case AnnotationAction.SELECT:
        /* Select annotation */ 
        let selectedAnnotation = this.getSelectedAnnotation(e) as AnnotationLayer | null;
        if (selectedAnnotation) {
          this.setSelectedAnnotation(selectedAnnotation as AnnotationLayer, true);
        } else {
          this.setSelectedAnnotation(null);
        }
        return;
      case AnnotationAction.EDIT:
        /* Update annotation */
        this.updateAnnotation(this.state.selectedAnnotation);
        return;
      case AnnotationAction.OPTIONS:
        this.setSelectedAnnotation(null);
        return;
      case AnnotationAction.GROUP:
        selectedAnnotation = this.getSelectedAnnotation(e) as AnnotationLayer | null;
        if (selectedAnnotation) {
          this.updateSelectedAnnotationCluster(selectedAnnotation);
        } 
        return;
      default:
        return
    }
  }
  
  private handleMouseMove = (e: L.LeafletMouseEvent) => {
    // console.log("🚀 ~ handleMouseMove:", e)
  }
  

  /* Handle event where mouse leaves map */
  private handleMouseOut = (e: L.LeafletMouseEvent) => {
    // console.log("🚀 ~ handleMouseOut:", e)
  }

  /* Handle event where mouse leaves map */
  private handleContextMenu = (e: L.LeafletMouseEvent) => {
    const selectedAnnotation = this.getSelectedAnnotation(e) as AnnotationLayer | null;
    if (selectedAnnotation) {
      const group = this.state.groupedAnnotations.find(cluster => 
        cluster.annotations.some(annotation => annotation === selectedAnnotation)
      )
      if (group) {
        this.setSelectedAnnotationGroup(group);
        return;
      }

      e.originalEvent.preventDefault();
      e.originalEvent.stopPropagation();
      const x = e.originalEvent.clientX;
      const y = e.originalEvent.clientY;
      
      this.annotationAction = AnnotationAction.OPTIONS;

      this.setState(prevState => {
        return {
          annotationOptionsMenuOpen: true,
          annotationOptionsMenuPosition: { x, y },
          annotationOptionsMenuSelection: {
            ...prevState.annotationOptionsMenuSelection,
            selectedAnnotation: selectedAnnotation,
          }
        }
      })
    } else {
      // Allow the default browser context menu to appear
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: e.originalEvent.clientX,
        clientY: e.originalEvent.clientY,
        button: e.originalEvent.button,
      });
      document.dispatchEvent(event);
    }
  }


  /**
   * @param e 
   * Find the selected annotation, if any, from a leaflet mouse event.
   * @returns L.Layer | null
  */
  private getSelectedAnnotation = (e: L.LeafletMouseEvent) => {
    const annotationLayers = this.annotationGroup.getLayers();
    const selectedAnnotation = annotationLayers.find((layer: any) => {
      const layerElement = layer._path || layer._icon;
      return layerElement === e.originalEvent.target;
    });

    return selectedAnnotation ?? null;
  }

  /**
   * Set selected annotation to new annotation
   * @param annotation - annotation layer to be selected
   */
  public setSelectedAnnotation(annotation: AnnotationLayer | null, editing?: boolean): void {
    this.setState(
      prevState => {
        const prevAnnotation = prevState.selectedAnnotation;
        if (prevAnnotation) {
          this.highlightAnnotation(prevAnnotation, false);
          prevAnnotation.editing.disable();
          prevAnnotation.fire("mouseout");
        }

        if (annotation) {
          const group = this.state.groupedAnnotations.find(cluster => 
            cluster.annotations.some(item => item === annotation)
          )
          this.setSelectedAnnotationGroup(group ?? null);
          this.highlightAnnotation(annotation);
          if (editing && !group) {
            annotation.editing?.enable();
          }
        } else {
          this.setSelectedAnnotationGroup(null);
        }

        /* Update selected annotation on menubar */
        if (this.menubarRef.current !== null) {
          this.menubarRef.current.setSelectedAnnotation(annotation);
        }

        return { selectedAnnotation: annotation };
      }
    )
    
    const tagId = annotation?.options?.annotationTag;
    if (tagId != undefined) {
      this.setAnnotationTag(tagId);
    }
  }

  public setSelectedAnnotationGroup(group: AnnotationCluster | null): void {
    this.setState(prevState => {
      if (group !== this.state.selectedGroupedAnnotations) {
        prevState.selectedGroupedAnnotations?.annotations.forEach(annotation => {
          this.highlightAnnotation(annotation, false);
        })
        prevState.selectedGroupedAnnotations?.bbox.setStyle({ opacity: 0 });

      }
      group?.annotations.forEach(annotation => {
        this.highlightAnnotation(annotation);
      });
      group?.bbox.setStyle({ opacity: 1 });

      return {
        selectedGroupedAnnotations: group
      }
    })
  }

  private updateSelectedAnnotationCluster = (annotation: AnnotationLayer) => {
    const currentClusterAnnotations = this.state.selectedAnnotationCluster?.annotations; 
    let updatedClusterAnnotations = currentClusterAnnotations?.slice() ?? [];

    const isSameTag = !currentClusterAnnotations?.length || 
      annotation.options.annotationTag === currentClusterAnnotations[0].options.annotationTag;

    if (!isSameTag) {
      this.updateCallout({
        content: 
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <h4 className={`bp3-text-muted ${this.props.useDarkTheme ? "bp3-dark" : ""}`} style={{ margin: 0 }}>
              You may only select annotations of the same tag
            </h4>
            <Button icon="group-objects" text="Group" minimal small 
              onClick={(_) => this.handleGroupAnnotations('accept')} 
              disabled={!this.state.selectedAnnotationCluster?.annotations.length}
            />
          </span>
      })
      return;
    } 

    if (currentClusterAnnotations?.includes(annotation)) {
      // Remove annotation from cluster
      this.highlightAnnotation(annotation, false);
      updatedClusterAnnotations = updatedClusterAnnotations?.filter(item => item !== annotation);
    } else {
      this.highlightAnnotation(annotation);
      updatedClusterAnnotations.push(annotation);
    }
  
    // Create or update the bounding box for the updated annotations
    const bbox = createBoundingBox(
      updatedClusterAnnotations,
      this.map,
    );

    this.setState(prevState => {
      prevState.selectedAnnotationCluster?.bbox.removeFrom(this.map);
      bbox.addTo(this.map);
      const updatedCluster = {
        ...prevState.selectedAnnotationCluster, 
        annotations: updatedClusterAnnotations,
        bbox: bbox,
      };

      return {
        selectedAnnotationCluster: updatedCluster
      }
    })

    // TODO: Center info component
    this.updateCallout({
      show: true,
      content: 
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <h4 className={`bp3-text-muted ${this.props.useDarkTheme ? "bp3-dark" : ""}`} style={{ margin: 0 }}>
            You have selected {this.state.selectedAnnotationCluster?.annotations.length} annotations
          </h4>
          <Button icon="group-objects" text="Group" minimal small 
            onClick={(_) => this.handleGroupAnnotations('accept')} 
            disabled={!this.state.selectedAnnotationCluster?.annotations.length}
          />
        </span>
    })
  }

  private resetSelectedAnnotationCluster = () => {
    // Unhighlight selected annotations
    this.state.selectedAnnotationCluster?.bbox.setStyle({ opacity: 0 });
    this.state.selectedAnnotationCluster?.annotations.forEach(annotation => {
      this.highlightAnnotation(annotation, false);
    })
    this.setState({ selectedAnnotationCluster: null });
  }

  /* Commit the currently selected annotations cluster as a group */
  private handleGroupAnnotations = (type: UserResponse) => {
    switch (type) {
      case 'accept':
        const currentAnnotationCluster = this.state.selectedAnnotationCluster;
        if (currentAnnotationCluster) {
          this.setState(prevState => {
            const newGroupedAnnotations = prevState.groupedAnnotations.slice();
            newGroupedAnnotations.push(currentAnnotationCluster);
            return { groupedAnnotations: newGroupedAnnotations }
          })
        }
        break;
      case 'decline':
        this.state.selectedAnnotationCluster?.bbox.removeFrom(this.map);
        break;
      default:
        break;
    }

    this.resetSelectedAnnotationCluster();
    this.resetCallout();
    this.annotationAction = AnnotationAction.SELECT;
  }

  /* For now, we only support `intersect` */
  private handleAnnotationOptionsMenuSelection = (value: any, key: string) => {
    this.setState(prevState => {
      const selection = prevState.annotationOptionsMenuSelection;
      if (key === "intersect") {
        selection.intersect = value.intersect;
        this.toaster.show(this.renderAlert(AlertContent.INTERSECT.PROMPT, undefined, undefined, 2000));
      }
     
      return { annotationOptionsMenuSelection: selection };
    });
  };

  /**
   * Increments the selected asset by 1 according to the left or right keys
   * @param left - Returns true for left key and false for right key
   */
  private switchAnnotation = (left: boolean) => {
    /**
     * Filter currently visible assets based on current settings
     * Only visible assets can be selected
     */
    const visibleAssets = this.state.assetList.filter((_: any) =>
      this.isAssetVisible()
    );

    const currentIndex = visibleAssets.findIndex(
      asset => asset.assetUrl === this.currentAsset.assetUrl
    );

    /* Aborts function if the direction of increment is out of bounds */
    if (
      (left && currentIndex <= 0) ||
      (!left && currentIndex >= visibleAssets.length - 1)
    ) {
      return;
    }

    const shift = left ? -1 : 1;
    const newIndex = Math.min(
      Math.max(0, currentIndex + shift),
      visibleAssets.length - 1
    );

    this.selectAsset(visibleAssets[newIndex]);

    /* Reset selected annotation */
    this.setSelectedAnnotation(null);

    const imageBar = document.getElementById("image-bar");
    if (imageBar !== null) {
      imageBar.scrollLeft += shift * 120;
    }
  };

  /**
   * Generic rendering that handles complex toast rendering
   */
  private handleProgressToast = (isSingleVideoPrediction = false) => {
    const key = this.toaster.show(this.renderProgress(0));
    /* Case where no ETA is needed */
    if (!isSingleVideoPrediction) {
      this.progressToastInterval = window.setInterval(() => {
        if (
          this.state.uiState === null ||
          this.state.predictDone === this.state.predictTotal
        ) {
          this.toaster.show(this.renderProgress(100), key);
          window.clearInterval(this.progressToastInterval);
        } else {
          /* Need to shift this over later */
          const addRand = (Math.random() * 15) / this.state.multiplier;
          if (this.state.predictDone + addRand < this.state.predictTotal * 0.98)
            this.setState(prevState => {
              return {
                predictDone: prevState.predictDone + addRand,
                multiplier: prevState.multiplier + 0.18,
              };
            });
          const donePercent =
            (this.state.predictDone / this.state.predictTotal) * 100;
          this.toaster.show(this.renderProgress(donePercent), key);
        }
      }, 200);
      /* Case where ETA is needed */
    } else {
      let eta: any;
      this.progressToastInterval = window.setInterval(() => {
        APIGetPredictionProgress().then(response => {
          const { progress, total } = response.data;
          if (!this.isFirstCallPerformed) {
            this.isFirstCallPerformed = true;
            /* Initialize ETA Instance to record estimated running time */
            eta = makeEta({
              min: progress,
              max: total,
              historyTimeConstant: 10,
            });
            eta.start();
            /* Default value of API call - when no video prediction */
          } else if (progress === 1 && total === 1) {
            this.toaster.show(this.renderProgress(100), key);
            window.clearInterval(this.progressToastInterval);
            this.isFirstCallPerformed = false;
            this.toaster.clear();
          } else {
            eta.report(progress);
            const secondsLeft = Math.ceil(eta.estimate());
            this.toaster.show(
              this.renderProgress(
                (progress * 100) / total,
                FormatTimerSeconds(secondsLeft)
              ),
              key
            );
          }
        });
      }, 500);
    }
  };

  private showToaster(toast: IToastProps) {
    this.toaster.show(toast);
  }

  private filterAnnotationVisibility(): void {
    /* Clear Annotation Layer */
    this.annotationGroup.clearLayers();
    const invertedProjectTags = invert(this.state.tagInfo.tags);

    /* Add Annotation Based on Confidence Value and filtered Tags */
    this.state.currentAssetAnnotations
      /*
       * @TODO : Refactor this before ProductHunt
       */
      .filter(
        (annotation: any) =>
          !this.state.hiddenAnnotations.has(annotation.options.annotationID) &&
          /* If no filters selected, should return true. This is to
              guard against some returning false on empty arrays */
          (this.state.filterArr.length === 0 ||
            /* Check if tag is present in filter (CASE-INSENSITIVE) */
            this.state.showSelected ===
              this.state.filterArr.some(filter =>
                invertedProjectTags[annotation.options.annotationTag]
                  .toLowerCase()
                  .includes(filter.toLowerCase())
              )) &&
          annotation.options.confidence >= this.state.confidence
      )
      .forEach((confidentAnnotation: any) => {
        /* Add It Onto Leaflet */
        // CAUTION: DEEP CLONE REMOVES UPDATES MADE ON ANNOTATION
        // const annotationToCommit = cloneDeep(confidentAnnotation);
        const annotationToCommit = confidentAnnotation;
        /* Customize Annotation Opacity */
        annotationToCommit.options.fillOpacity = this.state.annotationOptions.opacity;
        /* Customize Annotation Outline Toggle */
        annotationToCommit.options.weight = !this.state.annotationOptions
          .isOutlined
          ? 0
          : confidentAnnotation.options.weight;

        this.annotationGroup.addLayer(annotationToCommit);
      });

    this.annotationGroup.eachLayer(layer => this.bindAnnotationTooltip(layer));
  }

  /** Bind tooltip to annotation */
  private bindAnnotationTooltip = (layer?: L.Layer | any, label?: string) => {
    const InvertedTags = invert(this.state.tagInfo.tags);

    /* Had to inject custom CSS */
    layer.unbindTooltip();
    /* Render base tooltip first to check offset */
    const text = label ?? InvertedTags[layer.options.annotationTag] ?? '';
    layer.bindTooltip(
      `<span class='bp3-tag'
        style='
          color: #FFFFFF;
          border-radius: 6px !important;
          background-color: ${layer.options.color};
          z-index: -1;
          pointer-events: none;'
      >
        ${text}
      </span>`,
      {
        interactive: false,
        permanent: this.state.alwaysShowLabel,
        opacity: 0.9,
        direction: 'center'
      }
    );
    
  }

  /**
   * Check if a given asset should be visible given
   * the current settings
   * @param asset - asset object to check
   */
  private isAssetVisible() {
    /* Don't show annotated assets if annotatedAssetsHidden flag active */
    return !this.state.annotatedAssetsHidden;
  }

  /**
   * Handler for onImageChange - This function swaps image on leaflet canvas
   * as well as renders user-defined (if-any) annotation as LeafletLayerObjects
   * @param filename - URL of Asset
   */
  public selectAsset(asset: AssetAPIObject, singleAnalysis = true): void {
    /**
     * Check if there has been a reselection of asset, if so, we avoid
     * rescaling or map-fitting the current viewport to improve QoL
     */

    /* Checks if there is AssetReselection */
    const isAssetReselection = !(asset.assetUrl !== this.currentAsset.assetUrl);

    const currentVideoElement = this.videoOverlay.getElement();
    if (!isAssetReselection) {
      this.setState({ currentAssetAnnotations: [] });
      this.annotationGroup.eachLayer(layer => {
        this.annotationGroup.removeLayer(layer);
      });
      this.updateMenuBarAnnotations();
      if (currentVideoElement) {
        (currentVideoElement as any).cancelVideoFrameCallback(
          this.state.currAnnotationPlaybackId
        );
      }
    }

    const initialSelect = Object.keys(this.currentAsset).length === 0;
    this.imagebarRef.highlightAsset(asset.assetUrl);

    /* Clear Previous Images' Annotation from Annotation Group */
    this.annotationGroup.clearLayers();
    /**
     * PLEASE REMOVE IN FORESEABLE FUTURE
     */
    (this.annotationGroup as any).tags = this.state.tagInfo.tags;

    if (asset.type === "image") {
      if (!this.map.hasLayer(this.imageOverlay)) {
        this.videoOverlay.remove();
        this.imageOverlay.addTo(this.map);
      }

      /* Set Selected Image */
      const selectedImage = new Image();
      /* Assign Image URL */
      this.imageOverlay.setUrl(asset.assetUrl);
      selectedImage.src = asset.assetUrl;

      selectedImage.onload = () => {
        this.imageOverlay.setBounds(
          new L.LatLngBounds([
            [0, 0],
            [selectedImage.height, selectedImage.width],
          ])
        );

        /* Update Current Asset with Image Metadata */
        this.currentAsset = {
          ...asset,
          metadata: {
            width: selectedImage.width,
            height: selectedImage.height,
          },
        };
        /* Set Centre Viewport */
        if (!isAssetReselection) {
          /* Work Around, Allowing Map to Zoom to Any Factor */
          this.map.setMinZoom(-5);
          /* Invalidate Previous Sizing */
          this.map.invalidateSize();
          /* Artificial Delay */
          setTimeout(() => {
            this.map.fitBounds(this.imageOverlay.getBounds(), {
              padding: new L.Point(20, 20),
            });
          }, 150);
          /* Reset to Default Zoom */
          this.map.setMinZoom(-3);
          /* Get inference if Image is Cached */
          if (asset.isCached && singleAnalysis) this.singleAnalysis(false);
        }

        if (initialSelect) {
          this.setState({});
        }
      };

      /* Select background image in DOM */
      this.backgroundImg = document.querySelector(
        ".leaflet-pane.leaflet-overlay-pane img.leaflet-image-layer"
      );
    }
    if (asset.type === "video") {
      if (!this.map.hasLayer(this.videoOverlay)) {
        this.imageOverlay.remove();
        this.videoOverlay.addTo(this.map);
      }

      const selectedVideo = document.createElement("video");
      selectedVideo.setAttribute("src", asset.assetUrl);
      this.videoOverlay.setUrl(asset.assetUrl);

      selectedVideo.onloadedmetadata = () => {
        this.videoOverlay.setBounds(
          new L.LatLngBounds([
            [0, 0],
            [selectedVideo.videoHeight, selectedVideo.videoWidth],
          ])
        );

        /* Update Current Asset with Image Metadata */
        this.currentAsset = {
          ...asset,
          metadata: {
            width: selectedVideo.videoWidth,
            height: selectedVideo.videoHeight,
          },
        };

        const videoElement = this.videoOverlay.getElement();

        if (videoElement) {
          videoElement.controls = true;
          videoElement.setAttribute("controlsList", "nofullscreen nodownload");
        }

        if (!isAssetReselection) {
          /* Work Around, Allowing Map to Zoom to Any Factor */
          this.map.setMinZoom(-5);
          /* Invalidate Previous Sizing */
          this.map.invalidateSize();
          /* Artificial Delay */
          setTimeout(() => {
            this.map.fitBounds(this.videoOverlay.getBounds(), {
              padding: new L.Point(20, 20),
            });
            /* Reset to Default Zoom */
            this.map.setMinZoom(-3);

            /** Set Focus */
            videoElement?.focus();
          }, 150);
          /* Get inference if Video is Cached */
          if (asset.isCached && singleAnalysis) this.singleAnalysis(false);
        } else {
          /** Set Focus */
          videoElement?.focus();
        }
        if (initialSelect) {
          this.setState({});
        }
      };

      this.backgroundImg = document.querySelector(
        ".leaflet-pane.leaflet-overlay-pane video.leaflet-image-layer"
      );
    }
  }

  /**
   * Update annotations list in menu bar state
   * to current annotationGroup
   * FIXME: NEW ANNOTATIONS do not show up on menu immediately
   */
  public updateMenuBarAnnotations(): void {
    if (this.menubarRef.current !== null) {
      this.menubarRef.current.setAnnotations(this.annotationGroup);
    }
  }

  /**
   * Update annotations list in menu bar state
   * to current annotationGroup
   */
  public updateCurrentAssetAnnotations(annotations: PolylineObjectType[]): void {
    // console.log("🚀 ~ updateCurrentAssetAnnotations ~ updateCurrentAssetAnnotations:")
    this.setState({
      currentAssetAnnotations: annotations,
    });
  }
 

  /**
   * Set currently selected tag to target tag using respective hash
   * - Used to select annotation tag and update menu bar from external
   *  components, where tag index is unknown
   * @param tagHash - Tag hash of tag to be selected
   */
  public selectAnnotationTagByHash(tagHash: number): void {
    /* Find tag index */
    const tagId = Object.values(this.state.tagInfo.tags).find(tagid  => tagid === tagHash);
    if (tagId != undefined) {
      /* If target tag in project tags, set data members */
      this.currentTag = tagId;
      /* Update menu bar */
      if (this.menubarRef.current !== null)
        this.menubarRef.current.setAnnotationTag(tagId);
    }
  }

  /**
   * Refresh project for
   * - Annotation Tag Changes
   * - Get Periodic Updates
   */
  private async refreshProject() {
    // await APIGetProjectAnnotatorAssets(this.project).then(result => {
    //   this.setState({
    //     assetList: result.data.assets,
    //     projectTags: result.data.tags,
    //   });
    //   /* Effect Annotation Changes */
    // });
    this.selectAsset(this.currentAsset);
  }

  // DO THIS TOO
  /**
   * Add New Created Tag
   * - Callback for the Annotation level
   * - Updates the List of Project Tags when a new one is created in Annotation Select
   */
  public addNewTag(tagname: string, tagid: number): void {
    this.setState(prevState => {
      const updatedTags = { ...prevState.tagInfo.tags };
      updatedTags[tagname] = tagid;
      return {
        tagInfo: { modelHash: prevState.tagInfo.modelHash, tags: updatedTags },
      };
    }, () => {
      // Update the annotationGroup's tags with the new state after state update is complete
      (this.annotationGroup as any).tags = this.state.tagInfo.tags;
    })
  }

  /**
   * Disable All Handlers, Allowing for a single state only button management
   */
  public resetControls(): void {
    this.setUserState("None");
    /* this.handleDrawRectangle.disable();
    this.handleDrawPolygon.disable();
    this.handleRemoveAnnotation.disable(); */
    this.setSelectedAnnotation(null);
  }

  private syncAllFolders = async () => {
    this.setState({ isSyncing: true });

    await APIUpdateAsset()
      .then(() => {
        this.updateImage();
      })
      .catch(error => {
        let message = "Failed to sync all folders.";
        if (error.response) {
          message = `${error.response.data.message}`;
        }
        CreateGenericToast(message, Intent.DANGER, 3000);
      });
    this.setState({ isSyncing: false });
  };

  private renderProgress(amount: number, message = ""): IToastProps {
    const toastProps: IToastProps = {
      className: `bp3-text-muted ${this.props.useDarkTheme ? "bp3-dark" : ""}`,
      icon: "predictive-analysis",
      message: (
        <ProgressBar
          className={"predict-prog"}
          intent={amount < 100 ? "primary" : "success"}
          value={amount / 100}
        />
      ),
      onDismiss: (didTimeoutExpire: boolean) => {
        if (!didTimeoutExpire) {
          // user dismissed toast with click
          this.killVideoPrediction();
          window.clearInterval(this.progressToastInterval);
        }
        this.isFirstCallPerformed = false;
      },
      timeout: amount < 100 ? 0 : 600,
    };

    if (message !== "") toastProps.action = { text: message };

    return toastProps;
  }

  private renderAlert(message: string, icon?: any, intent?: Intent, timeout?: number, onDismiss?: (didTimeoutExpire: boolean) => void): IToastProps {
    const toastProps: IToastProps = {
      className: `bp3-text-muted ${this.props.useDarkTheme ? "bp3-dark" : ""}`,
      icon: icon,
      message: <p>{message}</p>,
      intent: intent,
      onDismiss: onDismiss,
      timeout: timeout ??  5000,
    };

    // if (message !== "") toastProps.action = { text: message };

    return toastProps;
  }

  /* Hotkey for Quick Annotation Selection */
  public renderHotkeys(): JSX.Element {
    return (
      <Hotkeys>
        {/* Hotkey Bindings for Annotations */}
        <Hotkey
          global={true}
          combo={"o"}
          label={"Open Folder"}
          onKeyDown={this.handleFileManagementOpen}
        />
        <Hotkey
          global={true}
          combo={"s"}
          label={"Sync All Folders"}
          onKeyDown={this.syncAllFolders}
        />
        <Hotkey
          global={true}
          combo={"A"}
          label={"Analyze"}
          onKeyDown={() => this.singleAnalysis()}
        />
        <Hotkey
          global={true}
          combo={"b"}
          label={"Bulk Analysis"}
          onKeyDown={this.bulkAnalysis}
        />
        <Hotkey
          global={true}
          combo={"esc"}
          label={"Exit Current Mode"}
          onKeyDown={this.resetControls}
        />
        <Hotkey
          global={true}
          combo={"h"}
          label={"Show / Hide Annotations"}
          onKeyDown={() => {
            /* Allow Toggling of Layer Hiding */
            if (this.map.hasLayer(this.annotationGroup))
              this.map.removeLayer(this.annotationGroup);
            else this.map.addLayer(this.annotationGroup);
          }}
        />
        <Hotkey
          global={true}
          combo={"l"}
          label={"Show / Hide Label"}
          onKeyDown={() => {
            /* Allow Toggling of Layer Hiding */
            this.setState(
              prevState => ({
                alwaysShowLabel: !prevState.alwaysShowLabel,
              }),
              () => {
                this.filterAnnotationVisibility();
              }
            );
          }}
        />
        <Hotkey
          global={true}
          combo={"left"}
          label={"Load previous asset"}
          onKeyDown={() => this.switchAnnotation(true)}
        />
        <Hotkey
          global={true}
          combo={"right"}
          label={"Load previous asset"}
          onKeyDown={() => this.switchAnnotation(false)}
        />
        <Hotkey
          global={true}
          combo={"space"}
          label={"Play/Pause Video"}
          onKeyDown={this.handlePlayPauseVideoOverlay}
        />
        <Hotkey
          global={true}
          combo={this.hotkeyToGroup}
          label={"Group anotations"}
          onKeyDown={this.handleKeyDownGroup}
          onKeyUp={this.handleKeyUpGroup}
          preventDefault={true}
          stopPropagation={true}
        />
        {Object.entries(this.state.tagInfo.tags).map(([tagname, tagid], idx) => {
          /* Only Perform Hotkey for First 9 Objects */
          if (idx > 9) return;

          // eslint-disable-next-line consistent-return
          return (
            <Hotkey
              key={tagname}
              global={true}
              combo={`${idx + 1}`}
              label={`Shortcut : ${tagname}`}
              onKeyDown={() => {
                this.currentTag = tagid;
                if (this.menubarRef.current != null)
                  this.menubarRef.current.setAnnotationTag(tagid);
              }}
            />
          );
        })}
      </Hotkeys>
    );
  }

  render(): JSX.Element {
    /* Prefix for Dynamic Styling of Collapsing Image List */
    const collapsedButtonTheme = this.props.useDarkTheme ? "" : "light-";
    const isCollapsed = this.state.imageListCollapsed ? "collapsed-" : "";

    /* Filter currently visible assets based on current settings */
    const visibleAssets = this.state.assetList.filter(() =>
      this.isAssetVisible()
    );

    return (
      <div>
        <Toaster {...this.state} ref={this.refHandlers.toaster} />
        <div className={"workspace"}>
          {/* Appends Styling Prefix if Image List is Collapsed */}
          <div
            className={[isCollapsed, "image-list"].join("")}
            id={"image-list"}
          >
            <Button
              className={[collapsedButtonTheme, "collapse-button"].join("")}
              large
              icon={this.state.imageListCollapsed ? "caret-up" : "caret-down"}
              onClick={() => {
                this.setState(prevState => ({
                  imageListCollapsed: !prevState.imageListCollapsed,
                }));
              }}
            />
            <div
              className={[collapsedButtonTheme, "collapse-button-effect"].join(
                ""
              )}
            />
            {/* Appends Styling Prefix */}
            <Card
              className={[isCollapsed, "image-bar"].join("")}
              id={"image-bar"}
            >
              <ImageBar
                ref={ref => {
                  this.imagebarRef = ref;
                }}
                /* Only visible assets should be shown */
                assetList={visibleAssets}
                callbacks={{ selectAssetCallback: this.selectAsset }}
                {...this.props}
              />
            </Card>
          </div>

          {/* Expands when Image Bar is Collapsed */}
          <div
            className={
              this.state.imageListCollapsed
                ? "expanded-annotator-space"
                : "annotator-space"
            }
          >
            {/* Non-Ideal State Render */}
            {Object.keys(this.currentAsset).length === 0 ? (
              <Card className={"annotator-non-ideal"}>
                <div className="bp3-non-ideal-state">
                  <div className="bp3-non-ideal-state-visual">
                    <span>
                      <Icon icon="media" iconSize={60} />
                    </span>
                  </div>
                  <h4 className="bp3-heading bp3-text-muted">
                    Select an Image to Annotate
                  </h4>
                </div>
              </Card>
            ) : null}
            {/* End Non-Ideal State Render */}
            <Card className={"main-annotator"}>
              <div id="annotation-map" className={"style-annotator"} />
              {this.backgroundImg ? (
                <div className="annotator-settings-button">
                  <AnnotatorSettings
                    annotationOptions={this.state.annotationOptions}
                    callbacks={{
                      setAnnotatedAssetsHidden: this.setAnnotatedAssetsHidden,
                      setAnnotationOptions: this.setAnnotationOptions,
                    }}
                  />
                </div>
              ) : null}
              <CardNotification
                show={this.state.callout.show}
                center={this.state.callout.center}
                onClose={this.state.callout.onClose}
              >
                {this.state.callout.content}
              </CardNotification>
            </Card>
          </div>
          <div className={"annotator-controls"}>
            <AnnotationMenu
              ref={this.menubarRef}
              isSyncing={this.state.isSyncing}
              projectTags={this.state.tagInfo.tags}
              userEditState={this.state.userEditState}
              changesMade={this.state.changesMade}
              uiState={this.state.uiState}
              predictDone={this.state.predictDone}
              predictTotal={this.state.predictTotal}
              hiddenAnnotations={this.state.hiddenAnnotations}
              confidence={this.state.confidence}
              filterArr={this.state.filterArr}
              showSelected={this.state.showSelected}
              useDarkTheme={this.props.useDarkTheme}
              isConnected={this.props.isConnected}
              loadedModel={this.props.loadedModel}
              currentAsset={this.currentAsset}
              assetList={this.state.assetList}
              callbacks={{
                ResetControls: this.resetControls,
                OpenFileManagement: this.handleFileManagementOpen,
                SetAnnotationTag: this.setAnnotationTag,
                OpenAdvancedSettings: this.handleAdvancedSettingsOpen,
                SetAnnotationVisibility: this.setAnnotationVisibility,
                SetSelectedAnnotation: this.setSelectedAnnotation,
                SingleAnalysis: this.singleAnalysis,
                BulkAnalysis: this.bulkAnalysis,
                ToggleConfidence: this.toggleConfidence,
                /* Used by TagSelector */
                SetFilterArr: this.setFilterArr,
                ToggleShowSelected: this.toggleShowSelected,
                SyncAllFolders: this.syncAllFolders,
              }}
            />
            {/* File Management Modal */}
            {this.state.fileManagementOpen ? (
              <FileModal
                onClose={this.handleFileManagementClose}
                isOpen={true}
                allowUserClose={true}
                callbacks={{
                  RefreshProject: this.refreshProject,
                  UpdateImage: this.updateImage,
                }}
                {...this.props}
              />
            ) : null}
            {/* Tag Management Modal */}
            {this.state.advancedSettingsOpen ? (
              <SettingsModal
                inferenceOptions={this.state.inferenceOptions}
                onClose={
                  !this.state.advancedSettingsOpen
                    ? this.handleAdvancedSettingsOpen
                    : this.handleAdvancedSettingsClose
                }
                isOpen={true}
                allowUserClose={true}
                callbacks={{
                  HandleChangeInSettings: this.handleChangeInAdvancedSettings,
                }}
                {...this.props}
              />
            ) : null}
            {/* Annotation Options Menu */}
            {this.state.annotationOptionsMenuOpen ? (
              <AnnotationOptionsMenu
                ref={this.annotationOptionsMenuRef}
                position={this.state.annotationOptionsMenuPosition}
                annotation={this.state.annotationOptionsMenuSelection.selectedAnnotation}
                tags={this.state.tagInfo.tags}
                onClose={
                  !this.state.annotationOptionsMenuOpen
                    ? this.handleAnnotationOptionsMenuOpen
                    : this.handleAnnotationOptionsMenuClose
                }
                callbacks={{
                  handleAnnotationOptionsMenuSelection: this.handleAnnotationOptionsMenuSelection,
                  updateAnnotation: this.updateAnnotation,
                }}
                {...this.props}
              />
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}
