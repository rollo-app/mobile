import { INFO_TOPICS, infoTopic, isInfoTopicId } from "../topics";

describe("info topics", () => {
  it("has a non-empty title and body for every topic, keyed by its own id", () => {
    const ids = Object.keys(INFO_TOPICS);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const topic = INFO_TOPICS[id as keyof typeof INFO_TOPICS];
      expect(topic.id).toBe(id);
      expect(topic.title.trim()).not.toBe("");
      expect(topic.body.trim()).not.toBe("");
    }
  });

  it("covers every place that shows an info button", () => {
    expect(Object.keys(INFO_TOPICS).sort()).toEqual(
      [
        "dates", "reveal", "quota", "moment", "momentWindow", "privateRollo",
        "publicProfile", "othersProfiles", "offlineMap", "inviteCode",
      ].sort(),
    );
  });

  it("keeps each text short", () => {
    for (const topic of Object.values(INFO_TOPICS)) expect(topic.body.length).toBeLessThan(600);
  });

  it("looks a topic up only by a known id", () => {
    expect(isInfoTopicId("reveal")).toBe(true);
    expect(isInfoTopicId("nope")).toBe(false);
    expect(infoTopic("reveal")?.title).toBe("Revelado");
    expect(infoTopic("nope")).toBeUndefined();
    expect(infoTopic(undefined)).toBeUndefined();
  });
});
