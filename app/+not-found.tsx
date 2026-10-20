import { Redirect } from "expo-router";

/** A link to something that isn't reachable (e.g. an app screen while signed out) lands on "/", which sends each state to its place. */
export default function NotFound() {
  return <Redirect href="/" />;
}
