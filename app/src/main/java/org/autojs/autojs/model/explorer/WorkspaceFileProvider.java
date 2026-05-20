package org.autojs.autojs.model.explorer;

import android.content.Context;
import android.content.res.AssetManager;

import com.stardust.autojs.project.ProjectConfig;
import com.stardust.pio.PFile;
import com.stardust.pio.PFiles;

import org.autojs.autojs.Pref;
import org.autojs.autojs.model.script.ScriptFile;

import java.io.File;
import java.io.FileFilter;
import java.io.FileNotFoundException;
import java.io.InputStream;

import io.reactivex.Observable;
import io.reactivex.Single;
import io.reactivex.schedulers.Schedulers;

public class WorkspaceFileProvider extends ExplorerFileProvider {

    private static final String SAMPLE_PATH = "sample";
    private static final String AUTOMATION_SCRIPTS_PATH = "automation_scripts";

    private final PFile mSampleDir;
    private final PFile mAutomationScriptsDir;
    private final AssetManager mAssetManager;
    private final Context mContext;

    public WorkspaceFileProvider(Context context, FileFilter fileFilter) {
        super(fileFilter);
        mContext = context;
        mAssetManager = context.getAssets();
        mSampleDir = new PFile(context.getFilesDir(), SAMPLE_PATH);
        mAutomationScriptsDir = new PFile(context.getFilesDir(), AUTOMATION_SCRIPTS_PATH);
    }

    @Override
    public Single<? extends ExplorerPage> getExplorerPage(ExplorerPage page) {
        ExplorerPage parent = page.getParent();
        String path = page.getPath();
        return listFiles(new PFile(path))
                .collectInto(createExplorerPage(path, parent), (p, file) -> {
                    if (file.isDirectory()) {
                        ProjectConfig projectConfig = ProjectConfig.Companion.fromProjectDir(file.getPath());
                        if (projectConfig != null) {
                            p.addChild(new ExplorerProjectPage(file, parent, projectConfig));
                            return;
                        }
                        if (inSampleDir(file)) {
                            p.addChild(new ExplorerSamplePage(file, p));
                        } else if (inAutomationScriptsDir(file)) {
                            p.addChild(new ExplorerAutomationScriptPage(file, p));
                        } else {
                            p.addChild(new ExplorerDirPage(file, p));
                        }
                    } else {
                        if (file.getPath().startsWith(mSampleDir.getPath())) {
                            p.addChild(new ExplorerSampleItem(file, p));
                        } else if (file.getPath().startsWith(mAutomationScriptsDir.getPath())) {
                            p.addChild(new ExplorerAutomationScriptItem(file, p));
                        } else {
                            p.addChild(new ExplorerFileItem(file, p));
                        }
                    }
                })
                .subscribeOn(Schedulers.io());
    }

    private boolean inSampleDir(PFile file) {
        return file.getPath().startsWith(mSampleDir.getPath());
    }

    private boolean inAutomationScriptsDir(PFile file) {
        return file.getPath().startsWith(mAutomationScriptsDir.getPath());
    }

    @Override
    protected Observable<PFile> listFiles(PFile directory) {
        if (inSampleDir(directory)) {
            return listAssetBackedFiles(directory, mSampleDir, SAMPLE_PATH);
        }
        if (inAutomationScriptsDir(directory)) {
            return listAutomationScripts(directory);
        }
        return super.listFiles(directory);
    }

    private Observable<PFile> listAutomationScripts(PFile directory) {
        return Observable.defer(() -> {
            copyAssetDir(AUTOMATION_SCRIPTS_PATH, mAutomationScriptsDir, false);
            return super.listFiles(directory);
        });
    }

    private Observable<PFile> listAssetBackedFiles(PFile directory, PFile rootDir, String assetRootPath) {
        String relativePath;
        if (directory.getPath().length() <= rootDir.getPath().length() + 1) {
            relativePath = "";
        } else {
            relativePath = directory.getPath().substring(rootDir.getPath().length());
        }
        String pathOfAsset = assetRootPath + relativePath;
        return Observable.just(pathOfAsset)
                .flatMap(path -> Observable.fromArray(mAssetManager.list(path)))
                .map(child -> {
                    PFile file = new PFile(new File(directory, child).getPath());
                    if (file.exists()) {
                        return file;
                    }
                    try {
                        InputStream stream = mAssetManager.open(pathOfAsset + "/" + child);
                        PFiles.copyStream(stream, file.getPath());
                    } catch (FileNotFoundException e) {
                        file.mkdirs();
                    }
                    return file;
                });
    }

    public Observable<ScriptFile> resetSample(ScriptFile file) {
        return resetAssetBackedFile(file, mSampleDir, SAMPLE_PATH);
    }

    public Observable<ScriptFile> resetAutomationScript(ScriptFile file) {
        return Observable.fromCallable(() -> {
            copyAssetDir(AUTOMATION_SCRIPTS_PATH, mAutomationScriptsDir, true);
            return file;
        })
                .subscribeOn(Schedulers.io());
    }

    public Observable<ScriptFile> resetBuiltInScript(ScriptFile file) {
        if (inSampleDir(file)) {
            return resetSample(file);
        }
        if (inAutomationScriptsDir(file)) {
            return resetAutomationScript(file);
        }
        return null;
    }

    private Observable<ScriptFile> resetAssetBackedFile(ScriptFile file, PFile rootDir, String assetRootPath) {
        if (file.getPath().length() <= rootDir.getPath().length() + 1) {
            return null;
        }
        String relativePath = file.getPath().substring(rootDir.getPath().length());
        String pathOfAsset = assetRootPath + relativePath;
        return Observable.fromCallable(() -> {
            InputStream stream = mAssetManager.open(pathOfAsset);
            PFiles.copyStream(stream, file.getPath());
            return file;
        })
                .subscribeOn(Schedulers.io());
    }

    private void copyAssetDir(String assetDirPath, File targetDir, boolean overwrite) throws java.io.IOException {
        String[] children = mAssetManager.list(assetDirPath);
        if (children == null) {
            return;
        }
        if (!targetDir.exists()) {
            targetDir.mkdirs();
        }
        for (String child : children) {
            copyAssetEntry(assetDirPath + "/" + child, new File(targetDir, child), overwrite);
        }
    }

    private void copyAssetEntry(String assetPath, File target, boolean overwrite) throws java.io.IOException {
        try (InputStream stream = mAssetManager.open(assetPath)) {
            if (target.exists() && !overwrite) {
                return;
            }
            File parent = target.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            PFiles.copyStream(stream, target.getPath());
        } catch (FileNotFoundException e) {
            copyAssetDir(assetPath, target, overwrite);
        }
    }

    @Override
    protected ExplorerDirPage createExplorerPage(String path, ExplorerPage parent) {
        ExplorerDirPage page = super.createExplorerPage(path, parent);
        if (new File(path).equals(new File(Pref.getScriptDirPath()))) {
            page.addChild(ExplorerSamplePage.createRoot(mSampleDir));
            page.addChild(ExplorerAutomationScriptPage.createRoot(mAutomationScriptsDir));
        }
        return page;
    }
}
