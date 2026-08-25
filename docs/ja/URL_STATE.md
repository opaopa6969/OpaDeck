# URLを1st-class stateとして扱う

OpaDeckのランタイムは、画面の意味をURLへ保存するための小さな基盤を提供する。
ページ固有の状態をランタイムが知るのではなく、機能側がadapterを渡す。

```js
import { createUrlState } from 'opadeck';

const urlState = createUrlState({
  window,
  adapter: {
    parse(url) {
      return { operationId: url.searchParams.get('operation') || null };
    },
    format(state, base) {
      const url = new URL(base.href);
      if (state.operationId) url.searchParams.set('operation', state.operationId);
      else url.searchParams.delete('operation');
      return url;
    },
    normalize(state) {
      return { operationId: state.operationId || null };
    },
  },
  onChange: (state, reason) => renderFromUrl(state, reason),
});

urlState.start();
// user action
urlState.navigate({ operationId: 'core.search' }, 'push');
```

## 規約

- `push`: ユーザーが戻る価値のある場所へ移動したとき
- `replace`: 正規化や入力途中など、履歴を増やしたくないとき
- `popstate`: URLを読み直して画面を再投影する。push/replaceは行わない
- `parse(format(state))` は `normalize(state)` と同値にする
- URLに入れるのは共有・再現したい意味状態だけ。秘密情報や巨大なpayloadは入れない

`createWorkbench`はURLの意味を直接持たない。アプリケーションは、selection/filterをURL stateへ変換するadapterを作り、Workbenchの公開操作と接続する。
これにより、Workbenchを埋め込むホストがpath/queryの設計を選べる。

## 推奨するURLの割り当て

```text
path   対象リソース（/deck/:id、/operation/:fqid）
query  一覧・検索・filter・sort・表示モード
hash   文書内の位置など、サーバー取得を変えないviewport
```

初期実装は `src/runtime/url-state.js`。Browser History APIに依存するが、adapterとwindowを注入できるため、Nodeのunit testで履歴遷移を検証できる。
