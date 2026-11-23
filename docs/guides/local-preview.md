# Preview locally

```sh
npx graphinity dev architecture.yml
```

starts a server on `http://127.0.0.1:4321/` and opens your browser.

## Edit with live reload

Keep the page open next to your editor. Every time you save a configuration file or a local
icon, the diagram updates - on the same universe, with the same zoom.

If you make a mistake, the terminal prints the error:

```
10:43:15 ✗ 1 error
  architecture.yml:9:9 connections[0].to: Unknown node or group "api" (connections must reference nodes or groups of the same universe)
```

The page keeps showing the diagram, without the element concerned (here, that connection), and
a *1 configuration error* button at the bottom lists the errors. Fix and save: the element comes
back. The server never stops on a configuration error.
See [When there are errors](/config/validation#when-there-are-errors).

## Useful options

```sh
# another port
npx graphinity dev architecture.yml --port 8080

# do not open the browser (remote machine, scripts)
npx graphinity dev architecture.yml --no-open

# universes reference files outside the root file's folder
npx graphinity dev apps/architecture.yml --project .
```

## Exploring the diagram

| Action | Effect |
| ------ | ------ |
| Click a node | Details: description, tags, group, connections, sub-universe, id, icon, source file. |
| Search field (top right; `/` or `Ctrl K`) | Finds a node or a group of any universe by name; choosing one opens its universe, frames it and highlights it. |
| Double-click a doubled node | Opens its universe. |
| Breadcrumb, back button | Go back up. |
| Drag a node or a group | Rearranges the view (not saved). |
| Scroll, drag the canvas | Zoom, pan. The bottom-left buttons zoom and fit the view. |
| Grid button (bottom left) | Shows or hides the grid (not saved). |
| Keep scrolling at maximum zoom | Opens the universe of the doubled node closest to the mouse cursor (a bar fills: about five notches of the wheel). |
| Keep zooming out, a little beyond the whole universe | Back to the parent (about five notches). |
| Click a door (`↩ …`) | Back to the universe of that node. |
| `Esc`, click on the canvas | Close the details. |

More: [Viewer](/reference/viewer), [`dev` reference](/cli/dev).
