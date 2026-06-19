import { describe, expect, it } from "vitest";
import { createTransferStore } from "../../src/main/core/transferStore";

describe("transfer store", () => {
  it("starts a transfer with active status and initial timestamps", () => {
    const store = createTransferStore(() => 100);

    const task = store.start({
      id: "transfer_1",
      name: "Photo.jpg",
      direction: "send",
      totalBytes: 500
    });

    expect(task).toEqual({
      id: "transfer_1",
      name: "Photo.jpg",
      direction: "send",
      totalBytes: 500,
      transferredBytes: 0,
      status: "active",
      startedAt: 100,
      updatedAt: 100
    });
    expect(store.list()).toEqual([task]);
  });

  it("tracks progress and completion", () => {
    const store = createTransferStore(createClock([100, 200, 300]));
    store.start({ id: "transfer_1", name: "Photo.jpg", direction: "send", totalBytes: 500 });

    store.progress("transfer_1", 250);
    expect(store.list()[0]).toMatchObject({
      transferredBytes: 250,
      status: "active",
      updatedAt: 200
    });

    store.complete("transfer_1");
    expect(store.list()[0]).toMatchObject({
      transferredBytes: 500,
      status: "completed",
      updatedAt: 300
    });
  });

  it("marks a transfer as failed with an error", () => {
    const store = createTransferStore(createClock([100, 200]));
    store.start({ id: "transfer_1", name: "Photo.jpg", direction: "receive", totalBytes: 500 });

    store.fail("transfer_1", "Connection lost");

    expect(store.list()[0]).toMatchObject({
      status: "failed",
      error: "Connection lost",
      updatedAt: 200
    });
  });

  it("clamps progress to the total byte count", () => {
    const store = createTransferStore(createClock([100, 200]));
    store.start({ id: "transfer_1", name: "Photo.jpg", direction: "send", totalBytes: 500 });

    store.progress("transfer_1", 750);

    expect(store.list()[0].transferredBytes).toBe(500);
  });

  it("clamps negative transfer sizes and progress to zero", () => {
    const store = createTransferStore(createClock([100, 200, 300]));
    store.start({ id: "transfer_1", name: "Photo.jpg", direction: "send", totalBytes: -500 });

    expect(store.list()[0]).toMatchObject({
      totalBytes: 0,
      transferredBytes: 0
    });

    store.progress("transfer_1", -1);
    expect(store.list()[0]).toMatchObject({
      transferredBytes: 0,
      updatedAt: 200
    });

    store.complete("transfer_1");
    expect(store.list()[0]).toMatchObject({
      transferredBytes: 0,
      status: "completed",
      updatedAt: 300
    });
  });

  it("clamps negative progress to zero for positive-size transfers", () => {
    const store = createTransferStore(createClock([100, 200]));
    store.start({ id: "transfer_1", name: "Photo.jpg", direction: "send", totalBytes: 500 });

    store.progress("transfer_1", -1);

    expect(store.list()[0]).toMatchObject({
      transferredBytes: 0,
      updatedAt: 200
    });
  });

  it("cancels a transfer", () => {
    const store = createTransferStore(createClock([100, 200]));
    store.start({ id: "transfer_1", name: "Photo.jpg", direction: "send", totalBytes: 500 });

    store.cancel("transfer_1");

    expect(store.list()[0]).toMatchObject({
      status: "canceled",
      updatedAt: 200
    });
  });

  it("does not complete a canceled transfer", () => {
    const store = createTransferStore(createClock([100, 200]));
    store.start({ id: "transfer_1", name: "Photo.jpg", direction: "send", totalBytes: 500 });

    store.cancel("transfer_1");
    store.complete("transfer_1");

    expect(store.list()[0]).toMatchObject({
      transferredBytes: 0,
      status: "canceled",
      updatedAt: 200
    });
  });

  it("does not complete a failed transfer", () => {
    const store = createTransferStore(createClock([100, 200]));
    store.start({ id: "transfer_1", name: "Photo.jpg", direction: "send", totalBytes: 500 });

    store.fail("transfer_1", "Connection lost");
    store.complete("transfer_1");

    expect(store.list()[0]).toMatchObject({
      transferredBytes: 0,
      status: "failed",
      error: "Connection lost",
      updatedAt: 200
    });
  });

  it("does not update progress after completion", () => {
    const store = createTransferStore(createClock([100, 200]));
    store.start({ id: "transfer_1", name: "Photo.jpg", direction: "send", totalBytes: 500 });

    store.complete("transfer_1");
    store.progress("transfer_1", 100);

    expect(store.list()[0]).toMatchObject({
      transferredBytes: 500,
      status: "completed",
      updatedAt: 200
    });
  });

  it("does not update progress after cancellation", () => {
    const store = createTransferStore(createClock([100, 200]));
    store.start({ id: "transfer_1", name: "Photo.jpg", direction: "send", totalBytes: 500 });

    store.cancel("transfer_1");
    store.progress("transfer_1", 100);

    expect(store.list()[0]).toMatchObject({
      transferredBytes: 0,
      status: "canceled",
      updatedAt: 200
    });
  });

  it("lists transfers by most recently updated first", () => {
    const store = createTransferStore(createClock([100, 200, 300]));
    store.start({ id: "older", name: "Older.jpg", direction: "send", totalBytes: 500 });
    store.start({ id: "newer", name: "Newer.jpg", direction: "receive", totalBytes: 500 });

    store.progress("older", 100);

    expect(store.list().map((task) => task.id)).toEqual(["older", "newer"]);
  });

  it("does not let mutations of listed tasks change stored state", () => {
    const store = createTransferStore(() => 100);
    store.start({ id: "transfer_1", name: "Photo.jpg", direction: "send", totalBytes: 500 });

    const listed = store.list();
    listed[0].name = "Mutated.jpg";
    listed[0].transferredBytes = 400;

    expect(store.list()[0]).toMatchObject({
      name: "Photo.jpg",
      transferredBytes: 0
    });
  });

  it("ignores updates for unknown ids", () => {
    const store = createTransferStore(createClock([100, 200]));
    store.start({ id: "transfer_1", name: "Photo.jpg", direction: "send", totalBytes: 500 });

    store.progress("missing", 100);
    store.complete("missing");
    store.fail("missing", "Nope");
    store.cancel("missing");

    expect(store.list()).toHaveLength(1);
    expect(store.list()[0]).toMatchObject({
      id: "transfer_1",
      transferredBytes: 0,
      status: "active",
      updatedAt: 100
    });
  });
});

function createClock(values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[index];
    index += 1;

    if (value === undefined) {
      throw new Error("Clock exhausted");
    }

    return value;
  };
}
