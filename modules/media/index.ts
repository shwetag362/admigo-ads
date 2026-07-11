// modules/media — public API (barrel).
// Media upload handlers (Meta AdImage/AdVideo). Currently the relocated route
// handlers; refactor into service/repository layers incrementally.
export { POST as uploadImage } from "./upload-image.handler";
export { POST as uploadVideo } from "./upload-video.handler";
