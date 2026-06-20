// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeviceDropTarget } from "../../src/renderer/src/components/DeviceDropTarget";

describe("DeviceDropTarget", () => {
  it("sends dropped files to the selected device", () => {
    const onDropPaths = vi.fn();
    const getPathForFile = vi.fn().mockReturnValue("C:\\Temp\\hello.txt");
    render(<DeviceDropTarget deviceName="Office PC" disabled={false} getPathForFile={getPathForFile} onDropPaths={onDropPaths} />);

    const file = new File(["hello"], "hello.txt");
    fireEvent.drop(screen.getByText("拖到这里发送给 Office PC"), { dataTransfer: { files: [file] } });

    expect(getPathForFile.mock.calls[0][0]).toBe(file);
    expect(onDropPaths).toHaveBeenCalledWith(["C:\\Temp\\hello.txt"]);
  });

  it("does not send dropped files while disabled", () => {
    const onDropPaths = vi.fn();
    const getPathForFile = vi.fn().mockReturnValue("C:\\Temp\\hello.txt");
    render(<DeviceDropTarget deviceName="Office PC" disabled={true} getPathForFile={getPathForFile} onDropPaths={onDropPaths} />);

    const file = new File(["hello"], "hello.txt");
    fireEvent.drop(screen.getByText("配对后可拖拽发送"), { dataTransfer: { files: [file] } });

    expect(getPathForFile).not.toHaveBeenCalled();
    expect(onDropPaths).not.toHaveBeenCalled();
  });
});
