// Direct-video path: no ImageBitmap transfer or worker canvas is required.
export async function createVideoDetector(){
  const {FilesetResolver,PoseLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
  const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
  return PoseLandmarker.createFromOptions(vision,{
    baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},
    runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,minTrackingConfidence:.55
  });
}
export function preferDirectVideo(nav=globalThis.navigator){
  // iPadOS can identify itself as a Mac; touch points also cover that case.
  return /iPad|iPhone|iPod/.test(nav?.userAgent||'') || (nav?.maxTouchPoints||0)>1;
}
export async function openCamera(mediaDevices){
  try{return await mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:{ideal:'user'},frameRate:{ideal:24,max:30}},audio:false});}
  catch(error){
    if(error.name!=='OverconstrainedError')throw error;
    return mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'}},audio:false});
  }
}
