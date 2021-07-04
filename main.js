let markdown_icon = `<svg viewBox="0 0 16 16">
  <path fill="currentColor" d="M14 3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h12zM2 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H2z"/>
  <path fill="currentColor" fill-rule="evenodd" d="M9.146 8.146a.5.5 0 0 1 .708 0L11.5 9.793l1.646-1.647a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 0-.708z"/>
  <path fill="currentColor" fill-rule="evenodd" d="M11.5 5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 .5-.5z"/>
  <path fill="currentColor" d="M3.56 11V7.01h.056l1.428 3.239h.774l1.42-3.24h.056V11h1.073V5.001h-1.2l-1.71 3.894h-.039l-1.71-3.894H2.5V11h1.06z"/>
</svg>`;

miro.onReady(() => {
    miro.initialize({
        extensionPoints: {
            bottomBar: async() => {
                let authorized = await miro.isAuthorized();
                if (!authorized) {
                    return false;
                }
                let canEditWidgets = await hasPermission("EDIT_CONTENT");
                if (!canEditWidgets) {
                    return false;
                }
                return {
                    title: "Markdown Converter",
                    svgIcon: markdown_icon,
                    onClick: markdownAction,
                };
            },
        },
    });
});

async function hasPermission(perm) {
    let permissions = await miro.currentUser.getCurrentBoardPermissions();
    for (let i = 0; i < permissions.length; i++) {
        if (permissions[i] === perm) {
            return true;
        }
    }
    return false;
}

async function markdownAction() {
    const selected_widgets = await miro.board.selection.get();
    if (selected_widgets.length === 0) {
        miro.showErrorNotification("Please select widgets to convert");
    } else {
        convertMarkdownWidgets(selected_widgets);
    }
}