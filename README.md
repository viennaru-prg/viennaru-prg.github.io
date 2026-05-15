# 내 홈페이지

GitHub Pages로 호스팅하는 개인 정적 웹사이트입니다.

## 미리보기

`index.html` 파일을 더블클릭하면 바로 브라우저에서 확인할 수 있습니다.

## GitHub에 올려서 인터넷에 공개하기

### 방법 A — GitHub 웹사이트로 (가장 쉬움, 설치 불필요)

1. https://github.com/new 에 접속해 새 저장소를 만듭니다.
   - 저장소 이름: `내아이디.github.io` 로 하면 주소가 `https://내아이디.github.io` 가 됩니다.
   - Public 으로 설정.
2. 만들어진 저장소 페이지에서 **"uploading an existing file"** 클릭.
3. 이 폴더의 `index.html`, `README.md` 를 드래그해서 올리고 **Commit changes**.
4. 잠시 후 `https://내아이디.github.io` 로 접속하면 사이트가 보입니다.
   - (저장소 이름을 다르게 했다면: Settings → Pages 에서 Branch 를 `main` 으로 지정 후
     `https://내아이디.github.io/저장소이름/` 으로 접속)

### 방법 B — git 명령으로 (이 폴더는 이미 git 준비 완료)

```powershell
git remote add origin https://github.com/내아이디/저장소이름.git
git branch -M main
git push -u origin main
```

푸시한 뒤 GitHub 저장소의 **Settings → Pages** 에서
Source 를 `Deploy from a branch`, Branch 를 `main / root` 로 설정하면 공개됩니다.

## 수정 방법

`index.html` 안의 텍스트를 원하는 내용으로 바꾸기만 하면 됩니다.
색상은 파일 상단 `:root` 의 변수 값을 바꾸면 전체 테마가 바뀝니다.
