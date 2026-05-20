package org.autojs.autojs.model.explorer;

import com.stardust.pio.PFile;

import java.io.File;

public class ExplorerAutomationScriptItem extends ExplorerFileItem {

    public ExplorerAutomationScriptItem(PFile file, ExplorerPage parent) {
        super(file, parent);
    }

    public ExplorerAutomationScriptItem(String path, ExplorerPage parent) {
        super(path, parent);
    }

    public ExplorerAutomationScriptItem(File file, ExplorerPage parent) {
        super(file, parent);
    }

    @Override
    public boolean canDelete() {
        return false;
    }

    @Override
    public boolean canRename() {
        return false;
    }
}
