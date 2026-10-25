/** A photo the in-app camera took: what the capture flow needs to prepare and queue it. */
export type CapturedPhoto = {
  uri: string;
  width: number;
  height: number;
};
