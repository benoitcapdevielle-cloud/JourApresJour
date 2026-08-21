& "C:\Users\benoi\Bureau\Nouveau\platform-tools-latest-windows\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
& "C:\Users\benoi\Bureau\Nouveau\platform-tools-latest-windows\platform-tools\adb.exe" shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"
