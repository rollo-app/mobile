import { WorstCaseScreen } from "@/features/profile/worst-case-screen";

/** Dev only: the profile header against worst-case data (break-ui). */
export default function WorstCaseRoute() {
  return __DEV__ ? <WorstCaseScreen /> : null;
}
