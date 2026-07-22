import React, { useEffect, useState, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';

import {
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
  Text,
} from 'react-native';

import {
  Delegate,
  RunningMode,
  useFaceLandmarkDetection,
} from 'react-native-mediapipe';

function EuclidianDistance(p1: any, p2: any): number {
  'worklet';
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function calculateEAR(
  face: any,
  pLeft: number,
  pRight: number,
  pTop1: number,
  pBottom1: number,
  pTop2: number,
  pBottom2: number,
): number {
  'worklet';

  const hDist = EuclidianDistance(face[pLeft], face[pRight]);
  const vDist1 = EuclidianDistance(face[pTop1], face[pBottom1]);
  const vDist2 = EuclidianDistance(face[pTop2], face[pBottom2]);

  if (hDist === 0) return 0;

  const ear = (vDist1 + vDist2) / (2.0 * hDist);

  if (ear === 0) return 1000;
  return ear;
}

function FaceLandmarkDetectionComponent() {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  const [isBlinking, setIsBlinking] = useState(false);
  const isCooldownRef = useRef(false);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  const triggerBlink = () => {
    if (isCooldownRef.current) return;

    isCooldownRef.current = true;
    setIsBlinking(true);

    setTimeout(() => {
      setIsBlinking(false);
      isCooldownRef.current = false;
    }, 100);
  };
  const triggerBlinkOnJS = Worklets.createRunOnJS(triggerBlink);
  const faceLandmarkDetection = useFaceLandmarkDetection(
    (result, vc) => {
      'worklet';
      const face = result.results?.[0].faceLandmarks?.[0];

      if (face) {
        const leftEAR = calculateEAR(face, 33, 133, 160, 144, 158, 153);
        const rightEAR = calculateEAR(face, 362, 263, 385, 380, 387, 373);

        const averageEAR = (leftEAR + rightEAR) / 2.0;

        console.log('MEDIA EAR: ', averageEAR);

        if (averageEAR < 0.05) {
          triggerBlinkOnJS();
        }
      }
    },
    error => {
      console.error('ERRO FACE LANDMARKING', error);
    },
    RunningMode.LIVE_STREAM,
    'face_landmarker.task',
    {},
  );

  useEffect(() => {
    faceLandmarkDetection.cameraDeviceChangeHandler(device);
  }, [device]);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Waiting for Camera permission...</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera device not found</Text>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        pixelFormat="rgb"
        onLayout={faceLandmarkDetection.cameraViewLayoutChangeHandler}
        frameProcessor={faceLandmarkDetection.frameProcessor}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isBlinking ? 'red' : 'white' },
        ]}
      />
    </View>
  );
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <FaceLandmarkDetectionComponent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 20,
    color: 'white',
  },
});

export default App;
