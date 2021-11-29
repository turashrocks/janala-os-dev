import type HTTPRequest from "browserfs/dist/node/backend/HTTPRequest";
import type IndexedDBFileSystem from "browserfs/dist/node/backend/IndexedDB";
import type IIsoFS from "browserfs/dist/node/backend/IsoFS";
import type OverlayFS from "browserfs/dist/node/backend/OverlayFS";
import type IZipFS from "browserfs/dist/node/backend/ZipFS";
import type { ApiError } from "browserfs/dist/node/core/api_error";
import type { BFSCallback } from "browserfs/dist/node/core/file_system";
import type { FSModule } from "browserfs/dist/node/core/FS";
import {
  handleFileInputEvent,
  iterateFileName,
} from "components/system/Files/FileManager/functions";
import type { AsyncFS } from "contexts/fileSystem/useAsyncFs";
import useAsyncFs from "contexts/fileSystem/useAsyncFs";
import type { UpdateFiles } from "contexts/session/types";
import { basename, dirname, extname, isAbsolute, join } from "path";
import { useCallback, useEffect, useState } from "react";

type FilePasteOperations = Record<string, "copy" | "move">;

export type FileSystemContextState = AsyncFS & {
  fs?: FSModule;
  mountFs: (url: string) => Promise<void>;
  setFileInput: React.Dispatch<
    React.SetStateAction<HTMLInputElement | undefined>
  >;
  unMountFs: (url: string) => void;
  addFile: (callback: (name: string, buffer?: Buffer) => void) => void;
  resetFs: () => Promise<void>;
  updateFolder: (folder: string, newFile?: string, oldFile?: string) => void;
  addFsWatcher: (folder: string, updateFiles: UpdateFiles) => void;
  removeFsWatcher: (folder: string, updateFiles: UpdateFiles) => void;
  pasteList: FilePasteOperations;
  createPath: (
    name: string,
    directory: string,
    buffer?: Buffer
  ) => Promise<string>;
  copyEntries: (entries: string[]) => void;
  moveEntries: (entries: string[]) => void;
  mkdirRecursive: (path: string) => Promise<void>;
};

const useFileSystemContextState = (): FileSystemContextState => {
  const { rootFs, IsoFS, ZipFS, ...asyncFs } = useAsyncFs();
  const { exists, mkdir, readFile, rename, writeFile } = asyncFs;
  const [fileInput, setFileInput] = useState<HTMLInputElement>();
  const [fsWatchers, setFsWatchers] = useState<Record<string, UpdateFiles[]>>(
    {}
  );
  const [pasteList, setPasteList] = useState<FilePasteOperations>({});
  const updatePasteEntries = (
    entries: string[],
    operation: "copy" | "move"
  ): void =>
    setPasteList(
      Object.fromEntries(entries.map((entry) => [entry, operation]))
    );
  const copyEntries = (entries: string[]): void =>
    updatePasteEntries(entries, "copy");
  const moveEntries = (entries: string[]): void =>
    updatePasteEntries(entries, "move");
  const addFsWatcher = useCallback(
    (folder: string, updateFiles: UpdateFiles): void =>
      setFsWatchers((currentFsWatcher) => ({
        ...currentFsWatcher,
        [folder]: [...(currentFsWatcher[folder] || []), updateFiles],
      })),
    []
  );
  const removeFsWatcher = useCallback(
    (folder: string, updateFiles: UpdateFiles): void =>
      setFsWatchers((currentFsWatcher) => ({
        ...currentFsWatcher,
        [folder]: (currentFsWatcher[folder] || []).filter(
          (updateFilesInstance) => updateFilesInstance !== updateFiles
        ),
      })),
    []
  );
  const updateFolder = useCallback(
    (folder: string, newFile?: string, oldFile?: string): void => {
      const relevantPaths =
        folder === "/"
          ? [folder]
          : Object.keys(fsWatchers).filter((fsPath) => fsPath === folder);
      const parentPath = !fsWatchers[folder] ? [dirname(folder)] : [];

      [...parentPath, ...relevantPaths].forEach((watchedFolder) =>
        fsWatchers[watchedFolder]?.forEach((updateFiles) =>
          watchedFolder === folder
            ? updateFiles(newFile, oldFile)
            : updateFiles()
        )
      );
    },

    [fsWatchers]
  );
  const mountFs = async (url: string): Promise<void> => {
    const fileData = await readFile(url);

    return new Promise((resolve, reject) => {
      const createFs: BFSCallback<IIsoFS | IZipFS> = (createError, newFs) => {
        if (createError) reject();
        else if (newFs) {
          rootFs?.mount?.(url, newFs);
          resolve();
        }
      };

      if (extname(url) === ".iso") {
        IsoFS?.Create({ data: fileData }, createFs);
      } else {
        ZipFS?.Create({ zipData: fileData }, createFs);
      }
    });
  };
  const unMountFs = (url: string): void => rootFs?.umount?.(url);
  const addFile = (callback: (name: string, buffer?: Buffer) => void): void => {
    fileInput?.addEventListener(
      "change",
      (event) => handleFileInputEvent(event, callback),
      { once: true }
    );
    fileInput?.click();
  };
  const resetFs = (): Promise<void> =>
    new Promise((resolve, reject) => {
      // eslint-disable-next-line no-underscore-dangle
      const overlayFs = rootFs?._getFs("/")?.fs as OverlayFS;
      const overlayedFileSystems = overlayFs.getOverlayedFileSystems();
      const readable = overlayedFileSystems.readable as HTTPRequest;
      const writable = overlayedFileSystems.writable as IndexedDBFileSystem;

      readable.empty();
      writable.empty((apiError) => (apiError ? reject(apiError) : resolve()));
    });
  const mkdirRecursive = async (path: string): Promise<void> => {
    const pathParts = path.split("/").filter(Boolean);
    const recursePath = async (position = 1): Promise<void> => {
      const makePath = join("/", pathParts.slice(0, position).join("/"));
      let created: boolean;

      try {
        created = (await exists(makePath)) || (await mkdir(makePath));
      } catch {
        created = false;
      }

      if (created && position !== pathParts.length) {
        await recursePath(position + 1);
      }
    };

    await recursePath();
  };
  const createPath = async (
    name: string,
    directory: string,
    buffer?: Buffer,
    iteration = 0
  ): Promise<string> => {
    const isInternal = !buffer && isAbsolute(name);
    const baseName = isInternal ? basename(name) : name;
    const uniqueName = !iteration
      ? baseName
      : iterateFileName(baseName, iteration);
    const fullNewPath = join(directory, uniqueName);

    if (isInternal) {
      if (name !== fullNewPath && !directory.startsWith(name)) {
        if (await exists(fullNewPath)) {
          return createPath(name, directory, buffer, iteration + 1);
        }

        if (await rename(name, fullNewPath)) {
          updateFolder(dirname(name), "", name);
        }

        return uniqueName;
      }
    } else {
      try {
        if (
          buffer
            ? await writeFile(fullNewPath, buffer)
            : await mkdir(fullNewPath)
        ) {
          return uniqueName;
        }
      } catch (error) {
        if ((error as ApiError)?.code === "EEXIST") {
          return createPath(name, directory, buffer, iteration + 1);
        }
      }
    }

    return "";
  };

  useEffect(() => {
    const watchedPaths = Object.keys(fsWatchers).filter(
      (watchedPath) => fsWatchers[watchedPath].length > 0
    );
    const mountedPaths = Object.keys(rootFs?.mntMap || {}).filter(
      (mountedPath) => mountedPath !== "/"
    );

    mountedPaths.forEach((mountedPath) => {
      if (
        !watchedPaths.some((watchedPath) => watchedPath.startsWith(mountedPath))
      ) {
        rootFs?.umount?.(mountedPath);
      }
    });
  }, [fsWatchers, rootFs]);

  return {
    addFile,
    addFsWatcher,
    copyEntries,
    createPath,
    mkdirRecursive,
    mountFs,
    moveEntries,
    pasteList,
    removeFsWatcher,
    resetFs,
    setFileInput,
    unMountFs,
    updateFolder,
    ...asyncFs,
  };
};

export default useFileSystemContextState;
