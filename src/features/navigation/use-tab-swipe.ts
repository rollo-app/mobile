import { router } from "expo-router";
import { useMemo, useRef } from "react";
import { PanResponder, type GestureResponderHandlers } from "react-native";
import { hasNoTrips } from "@/features/trips/active";
import { tabsFor } from "@/features/trips/tabs";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useRollPhase } from "@/features/trips/use-roll-phase";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { isHorizontalDrag, resolveSwipe, swipeHref, swipeTabs, swipeTarget, type SwipeTab } from "./swipe-targets";

/**
 * Responder handlers that move to the neighbor tab on a horizontal drag. Uses the JS PanResponder
 * (no native module): it only claims the touch once the drag is clearly horizontal, so vertical
 * scrolling, inner horizontal lists (which already own the touch) and the edge back swipe are untouched.
 */
export function useTabSwipe(current: SwipeTab): GestureResponderHandlers {
  const { trip, loaded } = useActiveTrip();
  const { detail } = useTripDetail(trip?.id);
  const phase = useRollPhase(detail);
  const { feedHidden } = tabsFor(phase, null, !hasNoTrips(loaded, trip));
  const visible = swipeTabs({ feedHidden });

  // The responder is created once; it reads the latest tabs through a ref.
  const latest = useRef({ current, visible });
  latest.current = { current, visible };

  return useMemo(
    () =>
      PanResponder.create({
        // The distance comes from the touch history: gestureState.dx restarts at the grant.
        onMoveShouldSetPanResponder: (evt) => {
          const history = evt.touchHistory;
          const touch = history.touchBank[history.indexOfSingleActiveTouch];
          if (history.numberActiveTouches !== 1 || !touch) return false;
          return isHorizontalDrag({
            dx: touch.currentPageX - touch.startPageX,
            dy: touch.currentPageY - touch.startPageY,
            startX: touch.startPageX,
          });
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (evt, g) => {
          const history = evt.touchHistory;
          const touch = history.touchBank[history.indexOfSingleActiveTouch];
          const dx = touch ? touch.currentPageX - touch.startPageX : g.dx;
          const dy = touch ? touch.currentPageY - touch.startPageY : g.dy;
          const direction = resolveSwipe({ dx, dy, vx: g.vx });
          if (!direction) return;
          const target = swipeTarget(latest.current.visible, latest.current.current, direction);
          if (target) router.navigate(swipeHref(target));
        },
      }).panHandlers,
    [],
  );
}
