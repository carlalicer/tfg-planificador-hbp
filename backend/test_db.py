import psycopg2

DATABASE_URL = "postgresql://postgres.nugbnbscniuojolszzri:Licerot9286*@aws-1-eu-central-1.pooler.supabase.com:6543/postgres"


try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT NOW();")
    print("CONEXIÓN OK:", cur.fetchone())
    cur.close()
    conn.close()

except Exception as e:
    print("ERROR:")
    print(e)