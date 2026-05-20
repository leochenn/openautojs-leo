package org.autojs.autojs.model.explorer;

import com.stardust.pio.PFile;

import java.io.File;

public class ExplorerAutomationScriptPage extends ExplorerDirPage {

    private boolean mRoot = false;

    public ExplorerAutomationScriptPage(PFile file, ExplorerPage parent) {
        super(file, parent);
    }

    public ExplorerAutomationScriptPage(String path, ExplorerPage parent) {
        super(path, parent);
    }

    public ExplorerAutomationScriptPage(File file, ExplorerPage parent) {
        super(file, parent);
    }

    public boolean isRoot() {
        return mRoot;
    }

    public static ExplorerAutomationScriptPage createRoot(PFile dir) {
        ExplorerAutomationScriptPage page = new ExplorerAutomationScriptPage(dir, null);
        page.mRoot = true;
        return page;
    }
}
