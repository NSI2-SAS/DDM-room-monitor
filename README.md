# DDM-room-monitor
A simple node server that gets DDM status and gives you the possibility to ignore warning if a domain is considered offline.

## Envornement variables
DDMSERVER : name of the serveur
TOKEN : DDM access token
PORT : port to access server

## Use 
```
DDMSERVER="" TOKEN="" node server.js
```

## Colors meaning 
- Green : OK
- Red : problem
- Yellow : has a grand master
- Gray : offline

Click on zone to select which device should be used to consider the domain is off (errors ignored)

![image](https://github.com/user-attachments/assets/f39580a9-c239-44cf-ac3f-0d437ab7d624)

## To Do

Change code comments from French to English
