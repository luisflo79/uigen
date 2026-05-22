import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock server actions
vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";

const mockSignInAction = vi.mocked(signInAction);
const mockSignUpAction = vi.mocked(signUpAction);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
});

describe("useAuth — initial state", () => {
  it("exposes signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(result.current.isLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------
describe("useAuth — signIn", () => {
  it("sets isLoading to true while pending and false after resolving", async () => {
    let resolveSignIn!: (v: { success: boolean }) => void;
    mockSignInAction.mockReturnValue(
      new Promise((res) => { resolveSignIn = res; })
    );
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "p1" } as any);

    const { result } = renderHook(() => useAuth());

    let signInPromise!: Promise<any>;
    act(() => {
      signInPromise = result.current.signIn("a@b.com", "password123");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignIn({ success: true });
      await signInPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("returns the action result on success", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([{ id: "p1" } as any]);

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "password123");
    });

    expect(returnValue).toEqual({ success: true });
  });

  it("returns the action result on failure without redirecting", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "wrong");
    });

    expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("resets isLoading to false even when the action throws", async () => {
    mockSignInAction.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("a@b.com", "password123").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("calls signInAction with the provided credentials", async () => {
    mockSignInAction.mockResolvedValue({ success: false, error: "err" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "mypassword");
    });

    expect(mockSignInAction).toHaveBeenCalledWith("user@example.com", "mypassword");
  });
});

// ---------------------------------------------------------------------------
// signUp
// ---------------------------------------------------------------------------
describe("useAuth — signUp", () => {
  it("sets isLoading to true while pending and false after resolving", async () => {
    let resolveSignUp!: (v: { success: boolean }) => void;
    mockSignUpAction.mockReturnValue(
      new Promise((res) => { resolveSignUp = res; })
    );
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "p1" } as any);

    const { result } = renderHook(() => useAuth());

    let signUpPromise!: Promise<any>;
    act(() => {
      signUpPromise = result.current.signUp("a@b.com", "password123");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignUp({ success: true });
      await signUpPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("returns the action result on success", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([{ id: "p99" } as any]);

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("new@b.com", "password123");
    });

    expect(returnValue).toEqual({ success: true });
  });

  it("returns the action result on failure without redirecting", async () => {
    mockSignUpAction.mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("dup@b.com", "password123");
    });

    expect(returnValue).toEqual({ success: false, error: "Email already registered" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("resets isLoading to false even when the action throws", async () => {
    mockSignUpAction.mockRejectedValue(new Error("db error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("a@b.com", "password123").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handlePostSignIn — anon work present with messages
// ---------------------------------------------------------------------------
describe("useAuth — post-sign-in: anon work with messages", () => {
  const anonWork = {
    messages: [{ role: "user", content: "make a button" }],
    fileSystemData: { "/App.jsx": "export default () => <button/>" },
  };

  beforeEach(() => {
    mockGetAnonWorkData.mockReturnValue(anonWork);
    mockCreateProject.mockResolvedValue({ id: "anon-project-1" } as any);
  });

  it("creates a project with the anon work data", async () => {
    mockSignInAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      })
    );
  });

  it("clears anon work after creating the project", async () => {
    mockSignInAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(mockClearAnonWork).toHaveBeenCalledOnce();
  });

  it("redirects to the new project's id", async () => {
    mockSignInAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(mockPush).toHaveBeenCalledWith("/anon-project-1");
  });

  it("does not call getProjects when anon work is present", async () => {
    mockSignInAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(mockGetProjects).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handlePostSignIn — anon work present but zero messages (should be ignored)
// ---------------------------------------------------------------------------
describe("useAuth — post-sign-in: anon work with no messages", () => {
  beforeEach(() => {
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
  });

  it("falls through to getProjects when messages array is empty", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "existing-1" } as any]);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(mockGetProjects).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith("/existing-1");
  });
});

// ---------------------------------------------------------------------------
// handlePostSignIn — no anon work, existing projects
// ---------------------------------------------------------------------------
describe("useAuth — post-sign-in: no anon work, existing projects", () => {
  beforeEach(() => {
    mockGetAnonWorkData.mockReturnValue(null);
  });

  it("redirects to the most recent project (index 0)", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([
      { id: "recent-project" } as any,
      { id: "older-project" } as any,
    ]);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(mockPush).toHaveBeenCalledWith("/recent-project");
  });

  it("does not create a project when one already exists", async () => {
    mockSignInAction.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "p1" } as any]);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handlePostSignIn — no anon work, no existing projects
// ---------------------------------------------------------------------------
describe("useAuth — post-sign-in: no anon work, no existing projects", () => {
  beforeEach(() => {
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new" } as any);
  });

  it("creates a new empty project", async () => {
    mockSignInAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
  });

  it("redirects to the newly created project", async () => {
    mockSignInAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(mockPush).toHaveBeenCalledWith("/brand-new");
  });

  it("gives the new project a non-empty name", async () => {
    mockSignInAction.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    const [call] = mockCreateProject.mock.calls;
    expect(call[0].name).toBeTruthy();
    expect(call[0].name.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// signUp triggers the same post-sign-in flow
// ---------------------------------------------------------------------------
describe("useAuth — signUp also runs post-sign-in flow", () => {
  it("redirects to the most recent project after a successful sign-up", async () => {
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([{ id: "p-signup" } as any]);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("new@b.com", "strongpass"); });

    expect(mockPush).toHaveBeenCalledWith("/p-signup");
  });

  it("creates a project from anon work after a successful sign-up", async () => {
    const anonWork = {
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: {},
    };
    mockSignUpAction.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(anonWork);
    mockCreateProject.mockResolvedValue({ id: "signup-anon" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("new@b.com", "strongpass"); });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: anonWork.messages })
    );
    expect(mockPush).toHaveBeenCalledWith("/signup-anon");
  });
});
