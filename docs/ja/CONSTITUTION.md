# OpaDeck 憲法

## 中核の一文

> OpaDeck は operation-centric な internal ops workbench である。  
> DataSource は field を支える first-class primitive だが、モデルの中心ではない。

## 原則

### 1. Operation first

第一単位は `Operation`。

- field は入力を提供する
- datasource は候補値や default/help データを提供する
- result view は結果を見せる
- help/tour は operation を理解させる
- layout は operation の見せ方を決める

### 2. 意味層を先に置く

次を分離する。

- semantic layer
- help layer
- rendering layer

表現は変えられても、業務意味は変えない。

### 3. stable id を前提にする

label は内部キーではない。

stable id を持つ対象:

- group
- operation
- field
- panel
- help target
- tour target

### 4. convention より validation

framework は少なくとも次を検証する。

- id 重複
- 参照切れ
- dependency cycle
- layout binding の不整合
- help/tour target の不整合

### 5. help は後付けではない

すべての OpaDeck アプリは次を持てるべき。

- inline help
- contextual help
- troubleshooting help
- interactive tour

### 6. layout は柔軟だが浅く始める

最初の primitive はこれだけ。

- split
- stack
- tabs
- panel

最初から重い docking IDE framework にはしない。

### 7. スコープは狭く保つ

OpaDeck は次になってはいけない。

- workflow engine
- public-site builder
- full low-code platform

