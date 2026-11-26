import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { RevealedPhoto } from "@/features/media/revealed";
import type { Award } from "../credits";
// Reanimated's real module needs the native worklets runtime: an empty object that `@/test/reanimated` fills.
jest.mock("react-native-reanimated", () => ({}));
import "@/test/reanimated";
import { CreditCard, creditLabel } from "../credit-card";

const photo = (): RevealedPhoto => ({
  shareable: false,
  id: "p1",
  type: "photo",
  takenAt: Date.parse("2027-01-12T06:17:00Z"),
  day: "2027-01-12",
  lat: null,
  lng: null,
  caption: null,
  durationS: null,
  width: null,
  height: null,
  thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  author: { id: "m1", userId: "u-m1", name: "Nico", username: null, avatarUrl: null },
  thumbPath: "/t",
  originalPath: "/o",
  displayPath: "/d",
  originalAvailable: true,
  authorUserId: "u-m1",
  featuredByMe: false,
  featureBlocked: false,
  likeCount: 0,
  canFeature: true,
  likedByMe: false,
  commentCount: 0,
  momentDay: null,
  archived: false,
  selfie: null,
  groupIds: [],
});

const award = (over: Partial<Award> = {}): Award => ({
  kind: "nightShift",
  title: "Turno noche",
  names: ["Nico"],
  detail: "03:17 · Día 2",
  photo: photo(),
  ...over,
});

describe("creditLabel", () => {
  it("reads the title, the names and the detail with commas", () => {
    expect(creditLabel(award())).toBe("Turno noche: Nico. 03:17, Día 2");
  });
});

describe("CreditCard", () => {
  it("shows the title in capitals, the shared names and the detail", async () => {
    await render(<CreditCard award={award({ names: ["Juani", "Sofi"], title: "Guion", detail: "14 textos" })} token="tok" />);
    expect(screen.getByText("GUION")).toBeTruthy();
    expect(screen.getByText("Juani y Sofi")).toBeTruthy();
    expect(screen.getByText("14 textos")).toBeTruthy();
  });

  it("is one VoiceOver element with the whole award as its label", async () => {
    await render(<CreditCard award={award()} token="tok" />);
    expect(screen.getByLabelText("Turno noche: Nico. 03:17, Día 2")).toBeTruthy();
  });

  it("fits two long names on a small screen", async () => {
    await render(<CreditCard award={award({ names: ["Maximiliano", "Constanza"] })} token="tok" />);
    const names = screen.getByText("Maximiliano y Constanza");
    expect(names.props.numberOfLines).toBe(2);
    expect(names.props.adjustsFontSizeToFit).toBe(true);
  });

  it("rises into place while entering, with opacity only under Reduce Motion", async () => {
    const reanimated = require("react-native-reanimated");
    const textBlock = () => StyleSheet.flatten(screen.getByText("Nico").parent!.props.style);
    await render(<CreditCard award={award()} token="tok" />);
    expect(textBlock().transform).toEqual([{ translateY: 0 }]);
    const original = reanimated.useReducedMotion;
    reanimated.useReducedMotion = () => true;
    try {
      await render(<CreditCard award={award()} token="tok" />);
      expect(textBlock().transform).toEqual([]);
      expect(textBlock().opacity).toBe(1);
    } finally {
      reanimated.useReducedMotion = original;
    }
  });
});
