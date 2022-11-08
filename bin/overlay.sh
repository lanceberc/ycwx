while [ 1 -gt 0 ] ; do
    date
    python.exe ./overlay.py -nesdis -region atlantic
    date
    python.exe ./overlay.py -nesdis -region pacific
    date
    python.exe ./overlay.py -nesdis -region storm
    date
    python.exe ./overlay.py -nesdis -region eddy
    date
    python.exe ./overlay.py -nesdis -region karl
    date
    sleep 2700
done
