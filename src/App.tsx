interface Hero {
  ename: number
  cname: string
  id_name: string
  title: string
  new_type: number
  hero_type: number
  hero_type2?: number
  skin_name: string
  moss_id: number
}

function App() {
  const [count, setCount] = useState(0)
  const [heroes, setHeroes] = useState<Hero[]>([])

  useEffect(() => {
    fetch('https://study.duyiedu.com/api/herolist')
      .then((res) => res.json())
      .then((json) => setHeroes(json.data))
  }, [])

  return (
    <>
      <span onClick={() => setCount(count + 1)}>{count}</span>
      <ul>
        {heroes.map((hero) => (
          <li key={hero.ename}>
            <strong>{hero.cname}</strong>({hero.title})
          </li>
        ))}
      </ul>
    </>
  )
}

export default App
